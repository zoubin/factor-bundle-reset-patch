var path = require('path');
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var buffer = require('gulp-buffer');
var gutil = require('gulp-util');

var factor = require('..');
var browserify = require('browserify');
var watchify = require('watchify');

var source = require('vinyl-source-stream');
var merge = require('merge-stream');
var readonly = require('read-only-stream');
var del = require('del');

var PassThrough = require('stream').PassThrough;

var fixtures = path.resolve.bind(path, __dirname);

gulp.task('clean', function (cb) {
    del(fixtures('dist'), cb);
});

gulp.task('default', ['clean'], function () {
    return bundle(getBundle());
});

gulp.task('watch', ['clean'], function (cb) {
    var b = watchify(getBundle());
    b.on('update', _bundle);
    _bundle();

    function _bundle() {
        bundle(b);
    }
});

function bundle(b) {
    return b.bundle()
        // from now on, use gulp plugins to transform contents
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest(fixtures('dist')))
        ;
}

function getBundle() {
    var entries = ['a.js', 'b.js'];
    var basedir = fixtures('src');
    var b = browserify(entries, { basedir: basedir })
    b.plugin(factor, {
        entries: entries,
        basedir: basedir,
        outputs: entries,
        // overwrite default `fs.createWriteStream` to make vinyl streams
        createWriteStream: source,
    });
    b.on('log', gutil.log);
    b.on('error', gutil.log);
    // make `bundle` return a vinyl stream.
    // perhaps another plugin to gulpify `bundle`
    b.bundle = function () {
        var pipeline = PassThrough({ objectMode: true });
        var common = browserify.prototype.bundle.call(b)
            .pipe(source('common.js'));
        b.once('factor.pipelines', function (files, pipelines, outputs) {
            merge(outputs.concat(common)).pipe(pipeline);
        });
        return readonly(pipeline);
    };
    return b;
}
