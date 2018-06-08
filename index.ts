const through = require('through2')
const exec = require('child-process-promise').exec
const gutil = require('gulp-util')
const path = require('path')
const Q = require('q')
const FS = require('q-io/fs')

const PLUGIN_NAME = 'gulp-fontcustom'

/**
*  Takes an key-value hash and returns an array with
*  the following structure:
*
*  {key: 'val', foo: 'bar'}
*  => ['--key', 'val', '--foo', 'bar']
*/
function toArgumentArray(src: { [key: string]: any }) {
    return Object.keys(src).reduceRight((prev, key) => prev.concat(`--${key}`, src[key]), [])
}

/**
*  Creates a virtual file from an existing Vinyl file
*  along with the contents from a generated file.
*
*  @return A Promise
*/
function createVinylFromFile(file, tmp, generatedFile) {
    const tmpFile = path.join(tmp, generatedFile)

    return FS.read(tmpFile, { flags: 'b' }).then(function (contents) {
        const deferred = Q.defer()

        const vinyl = new gutil.File({
            cwd: file.cwd,
            base: file.base,
            path: file.base + generatedFile
        })

        try {
            vinyl.contents = contents
            deferred.resolve(vinyl)
        } catch (e) {
            deferred.reject(e)
        }

        return deferred.promise
    })
}

function getGeneratedFiles(tmp) {
    return FS.list(tmp)
        .catch(function () {
            return FS.makeDirectory(tmp)
                .then(function () {
                    return FS.list(tmp)
                })
        })
}

const cmd = 'fontcustom compile'
const defaults = {
    no_hash: true,
    force: true
}

export = function (options: any = {}) {

    Object.assign(options || {}, defaults, options || {})

    const inputs = new Set<string>()
    const sources: { [key: string]: any } = {}

    /**
    *  Used for transforming the SVG file objects with fontcustom
    *
    *  TODO: This function is called for every SVG icon in the
    *  src destination. Not desirable :) Should instead wait.
    */
    function collectIcons(source, _enc, done) {
        const stream = this
        const notDir = !source.isDirectory()

        if (notDir && source.isNull()) {
            stream.push(source)
            return done()
        }

        if (source.isStream()) {
            stream.emit('error', new gutil.PluginError(PLUGIN_NAME, "Streams aren't supported"))
            return done()
        }

        if (notDir && '.svg' !== path.extname(source.path)) {
            stream.push(source)
            return done()
        }

        const input = notDir ? path.dirname(source.path) : source.path

        inputs.add(input)
        sources[input] = source

        done()
    }

    function generateFont(done) {
        const stream = this
        const promises: Array<Promise<any>> = []

        inputs.forEach(input => {
            // Temp dir for the fontcustom command output
            const tmp = options.output = `./___tmp-${Math.random().toFixed(10).substr(2)}___`
            const args = toArgumentArray(Object.assign({}, options, {
                output: tmp
            }))

            // fontcustom compile /___tmp___ --output <output> [other options]
            promises.push(
                exec([cmd, input.replace(/\\/g, '/')].concat(args).join(' '))
                    .then(() => getGeneratedFiles(tmp))
                    .then(files => Promise.all(
                        files.map(file => createVinylFromFile(sources[input], tmp, file)
                            .then(vinyl => stream.push(vinyl))
                        )
                    ))
                    .catch(err => stream.emit('error', new gutil.PluginError(PLUGIN_NAME, err)))
                    .then(() => FS.removeTree(tmp))
            )
        })

        Promise.all(promises)
            .then(() => done())
            .catch(err => done(err))
    }

    return through.obj(collectIcons, generateFont)
}
