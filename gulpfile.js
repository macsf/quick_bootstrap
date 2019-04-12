const gulp = require('gulp');
const sass = require('gulp-sass');
const del = require('del');
const uglify = require('gulp-uglify');
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const merge = require('merge-stream');
const concat = require('gulp-concat');

const htmlreplace = require('gulp-html-replace');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const perfectionist = require('perfectionist');
// const pngquant = require('imagemin-pngquant');
const cssmqpack = require('css-mqpacker');
const pmergerules = require('postcss-merge-rules');
const pmergelonghand = require('postcss-merge-longhand');
const pnocomment = require('postcss-discard-comments');
const babel = require('gulp-babel');
const browserSync = require('browser-sync').create();

const bootstrap = require('./bootstrap_modules');

const processors = [
  pnocomment,
  cssmqpack,
  pmergerules,
  pmergelonghand,
  autoprefixer({
    browsers: ['> 2% in TH', 'last 2 versions']
  }),
  perfectionist({
    indentSize: 2,
    cascade: true
  })
];

// Clean task
gulp.task('clean', () => del(['dist', 'build']));

// Copy third party libraries from node_modules into /vendor
gulp.task('vendor:js', () => {
  const moduleFiles = [];
  const bootstrapModules = [
    ...bootstrap.features.js,
    ...bootstrap.features.cssJs
  ];

  bootstrapModules.forEach(module => {
    moduleFiles.push(`./node_modules/bootstrap/js/dist/${module}.js`);
  });

  gulp
    .src([
      './node_modules/jquery/dist/*',
      '!./node_modules/jquery/dist/core.js',
      './node_modules/popper.js/dist/umd/popper.*'
    ])
    .pipe(gulp.dest('./build/js/vendor'));

  return gulp
    .src(moduleFiles)
    .pipe(concat('bootstrap.min.js'))
    .pipe(gulp.dest('./build/js/vendor'));
});

// Copy font-awesome from node_modules into /fonts
gulp.task('vendor:fonts', () =>
  gulp
    .src([
      './node_modules/font-awesome/**/*',
      '!./node_modules/font-awesome/{less,less/*}',
      '!./node_modules/font-awesome/{scss,scss/*}',
      '!./node_modules/font-awesome/.*',
      '!./node_modules/font-awesome/*.{txt,json,md}'
    ])
    .pipe(gulp.dest('./build/fonts/font-awesome'))
);

// vendor task
gulp.task('vendor', gulp.parallel('vendor:fonts', 'vendor:js'));

// Copy vendor's js to /dist
gulp.task('vendor:build', () => {
  const jsStream = gulp
    .src([
      './build/js/vendor/bootstrap.min.js',
      './build/js/vendor/jquery.slim.min.js',
      './build/js/vendor/popper.min.js'
    ])
    .pipe(gulp.dest(`./dist/js/vendor`));
  const fontStream = gulp
    .src(['./build/fonts/font-awesome/**/*.*'])
    .pipe(gulp.dest(`./dist/fonts/font-awesome`));
  return merge(jsStream, fontStream);
});

// Copy Bootstrap SCSS(SASS) from node_modules to /assets/scss/bootstrap
gulp.task('bootstrap:scss', () => {
  const moduleFiles = [
    './node_modules/bootstrap/scss/_functions.scss',
    './node_modules/bootstrap/scss/_variables.scss',
    './src/scss/_variables.scss'
  ];

  const bootstrapModules = [
    ...bootstrap.features.css,
    ...bootstrap.features.cssJs
  ];

  bootstrapModules.forEach(module => {
    moduleFiles.push(`./node_modules/bootstrap/scss/_${module}.scss`);
  });

  return gulp
    .src(moduleFiles)
    .pipe(concat('bootstrap.min.css'))
    .pipe(
      sass
        .sync({
          outputStyle: 'expanded',
          includePaths: ['./node_modules/bootstrap/scss']
        })
        .on('error', sass.logError)
    )
    .pipe(postcss(processors))
    .pipe(cleanCSS())
    .pipe(gulp.dest('./dist/css'));
});

gulp.task('css', () =>
  gulp.src('css/*.css', { base: './src' }).pipe(gulp.dest('./dist/css'))
);

// Compile SCSS(SASS) files
gulp.task(
  'scss',
  gulp.series(gulp.parallel('bootstrap:scss', 'css'), () =>
    gulp
      .src(['./src/scss/*.scss'])
      .pipe(
        sass
          .sync({
            outputStyle: 'expanded'
          })
          .on('error', sass.logError)
      )
      .pipe(postcss(processors))
      .pipe(gulp.dest('./build/css'))
  )
);

// Minify CSS
gulp.task(
  'css:minify',
  gulp.series('scss', () =>
    gulp
      .src('./build/css/style.css')
      .pipe(cleanCSS())
      .pipe(
        rename({
          suffix: '.min'
        })
      )
      .pipe(gulp.dest(`./dist/css`))
      .pipe(browserSync.stream())
  )
);

// Minify Js
gulp.task('js:minify', () => {
  gulp
    .src(['./src/js/script.js'])
    .pipe(babel({ presets: ['babel-preset-env'] }))
    .pipe(gulp.dest(`./build/js`));

  return gulp
    .src(['./src/js/script.js'])
    .pipe(babel({ presets: ['babel-preset-env'] }))
    .pipe(uglify())
    .pipe(
      rename({
        suffix: '.min'
      })
    )
    .pipe(gulp.dest(`./dist/js`))
    .pipe(browserSync.stream());
});

// Replace HTML block for Js and Css file upon build and copy to /dist
gulp.task('replaceHtmlBlock', () => {
  // gulp.src(['./build/css/bootstrap.min.css']).pipe(gulp.dest(`./dist/css`));

  return gulp
    .src(['./src/*.{html,php}'])
    .pipe(
      htmlreplace({
        js: [
          '/js/vendor/jquery.slim.min.js',
          '/js/vendor/popper.min.js',
          '/js/vendor/bootstrap.min.js',
          '/js/script.min.js'
        ],
        css: [
          '/fonts/font-awesome/css/font-awesome.css',
          '/css/bootstrap.min.css',
          '/css/style.min.css'
        ]
      })
    )
    .pipe(gulp.dest('./dist'));
});

// Configure the browserSync task and watch file path for change
gulp.task('dev', done => {
  browserSync.init({
    proxy: '127.0.0.1:4000',
    browser: 'google chrome',
    open: false
    // server: {
    //   baseDir: './'
    // }
  });
  gulp.watch(
    ['src/scss/*.scss', 'src/scss/**/*.scss'],
    gulp.series('css:minify', done => {
      browserSync.reload();
      done(); // Async callback for completion.
    })
  );
  gulp.watch(
    'src/js/script.js',
    gulp.series('js:minify', done => {
      browserSync.reload();
      done();
    })
  );
  gulp.watch(
    ['./src/*.{html,php}', './src/favicon*.*', './src/img/**'],
    gulp.series('replaceHtmlBlock', done => {
      browserSync.reload();
      done();
    })
  );
  done();
});

// Build task
gulp.task(
  'build',
  gulp.series(
    gulp.parallel('css:minify', 'js:minify', 'vendor'),
    'vendor:build',
    () =>
      gulp
        .src(
          [
            './src/.htaccess',
            './src/*.{html,php}',
            './src/favicon*.*',
            './src/img/**'
          ],
          {
            allowEmpty: true
          }
        )
        .pipe(gulp.dest('./dist'))
  )
);

// Default task
gulp.task('default', gulp.series('clean', 'build', 'replaceHtmlBlock'));
gulp.task('serve', gulp.series('clean', 'build', 'replaceHtmlBlock', 'dev'));
