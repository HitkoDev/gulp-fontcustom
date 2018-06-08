require('should')

const gulp = require('gulp')
const gutil = require('gulp-util')
const es = require('event-stream')
const fs = require('fs')
const rmdir = require('rimraf')

const converter = require('../')

describe('gulp-fontcustom', function () {

    it('should not support stream mode', function (done) {
        gulp.src(__dirname + "/fixtures/*.svg", { buffer: false })
            .pipe(converter().on('error', function (err) {
                err.should.exist
                done()
            }))
    })

    describe('in buffer mode', function () {

        it('should generate font files into destination', function (done) {

            gulp.src(__dirname + "/fixtures/*.svg")
                .pipe(converter({
                    font_name: 'myfont'
                }))
                .pipe(gulp.dest(__dirname + "/results"))
                .pipe(es.wait(function () {

                    ['eot', 'svg', 'woff', 'ttf'].forEach(function (type) {
                        fs.existsSync(__dirname + '/results/myfont.' + type).should.be.true
                    })

                    done()
                }))
        })
    })
})

afterEach(function () {
    rmdir(__dirname + "/results", gutil.noop)
})
