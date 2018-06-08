const gulp = require('gulp')
const mocha = require('gulp-mocha')

gulp.task('default', ['test'])

gulp.task('test', () =>
    gulp.src('test/tests.js')
        .pipe(mocha({ reporter: "spec" }))
)
