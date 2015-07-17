var path = require('path');
var mix = require('util-mix');
var factor = require('factor-bundle');
var Writable = require('stream').Writable;
var noop = function(){};
var fs = require('fs');

module.exports = function (b, opts) {
    opts = opts || {};

    var entries = opts.entries;
    var outputs = opts.outputs;

    opts.outputs = entries.map(createDummyWriteStream);
    if (!opts.createWriteStream) {
        opts.createWriteStream = fs.createWriteStream;
    }

    b.on('factor.pipeline', function() {
        var files = [];
        var pipelines = [];
        var len = entries.length;
        var packOpts = mix({}, b._options, {
            raw: true,
            hasExports: true
        });
        return function (file, pipeline) {
            files.push(file);
            if (pipelines.push(pipeline) < len) {
                return;
            }
            var outputStreams = buildOutStreams(outputs, opts);
            pipelines.forEach(function (pipeline, i) {
                if (opts.pack) {
                    var labeled = pipeline.get('pack');
                    labeled.splice(labeled.length - 1, 1, opts.pack(packOpts));
                }
                if (outputStreams[i]) {
                    pipeline.unpipe();
                    pipeline.pipe(outputStreams[i]);
                }
            });
            b.emit('factor.pipelines', files, pipelines, outputStreams);
            files = [];
            pipelines = [];
        };
    }());

    return factor(b, opts);
}

function buildOutStreams(outputs, opts) {
    if (typeof outputs === 'function') {
        return outputs(opts.entries, opts.basedir);
    }
    return [].concat(outputs).map(function (o) {
        if (isStream(o)) {
            return o;
        }
        return opts.createWriteStream(o);
    });
}

function isStream(s) {
    return s && typeof s.pipe === 'function';
}

function createDummyWriteStream() {
    var ws = Writable({ objectMode: true });
    ws._write = noop;
    return ws;
}
