var test = require('tape');
var factor = require('..');
var browserify = require('browserify');
var watchify = require('watchify');
var vm = require('vm');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var common = path.join(__dirname, 'fixtures', 'delta');
var sink = require('sink-transform');

var os = require('os');
var tmpdir = path.join((os.tmpdir || os.tmpDir)(), 'factor-' + Math.random());

function fixtures(file) {
    return path.join(tmpdir, file);
}

mkdirp.sync(tmpdir);

var pool = {};

write(fixtures('c.js'), 1);

var entries = ['a.js', 'b.js'].map(fixtures);
entries.forEach(function (file, i) {
    write(file, i);
});

test('watchify', function(t) {
    var pending = 3;
    var changeNum = 3;
    console.log('='.repeat(80));
    console.log('Expecting', (changeNum + 1) * 3, 'plans');
    console.log('='.repeat(80));
    console.log('\n');
    t.plan((changeNum + 1) * 3);
    var w = watchify(browserify(entries, watchify.args));
    w.plugin(factor, {
        entries: entries,
        outputs: function (e) {
            return e.map(function () {
                return sink.PassThrough();
            });
        },
    });

    var srcs = {};
    w.on('factor.pipelines', function (files, pipelines, outputStreams) {
        outputStreams.forEach(function (s, i) {
            s.pipe(sink.str(function (src, next) {
                maybeDone(path.basename(files[i], '.js'), src);
                next();
            }));
        });
    });

    w.on('factor.done', change);
    w.on('update', bundle);
    function bundle() {
        pending = 3;
        w.bundle(function (err, src) {
            src = src.toString('utf8');
            maybeDone('c', src);
        });
    }
    console.log('='.repeat(80))
    console.log('initial bundle')
    console.log('-'.repeat(80))
    bundle();
    

    function maybeDone(k, src) {
        srcs[k] = src;
        pending--;
        if (pending === 0) {
            t.equal(run(srcs.c + srcs.a), pool.a + pool.c);
            t.equal(run(srcs.c + srcs.b), pool.b + pool.c);
            t.equal(run(srcs.c + ';require(1);'), pool.c);
            console.log('Bundle Done', pool);
            srcs = {};
            w.emit('factor.done');
        }
    }

    function change() {
        if (!changeNum--) {
            setTimeout(function() {
                w.close();
            }, 10)
            console.log('\n');
            console.log('='.repeat(80));
            console.log('WATCH CLOSED');
            console.log('='.repeat(80));
            return;
        }
        setTimeout(function() {
            var file = [fixtures('c.js')].concat(entries)[changeNum % 3];
            var k = path.basename(file, '.js');
            var n = Math.floor(Math.random() * 10) + 1 + pool[k];
            console.log('='.repeat(80))
            console.log('Changing ', k, 'to', n)
            console.log('-'.repeat(80))
            write(file, n);
        }, 200);
    }
})


function run (src) {
    var output = 0;
    function log (msg) { output += +msg }
    vm.runInNewContext(src, { console: { log: log } });
    return output;
}

function write(file, n) {
    var base = path.basename(file, '.js');
    pool[base] = n;
    var content = (base === 'c' ? '' : 'require("./c.js");') + 'console.log(' + n + ');' + '// ' + file;
    fs.writeFileSync(file, content);
}
