#!/usr/bin/env node

/*
Copyright (c) 2017 rtrdprgrmr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var http = require('http');
var WebSocket = require('ws');

var server = http.createServer(function(req, res) {
    if (req.url == "/") {
        res.end(
            '<html><body>' +
            '<button onclick="download()">download</button>' +
            '<button onclick="upload()">upload</button>' +
            '<button onclick="websocket_upload()">websocket_upload</button>' +
            '<p>results will be printed in the console</p>' +
            '<script>' +
            createData +
            download +
            upload +
            websocket_upload +
            '</script>' +
            '</body></html>'
        );
    } else if (req.url == "/download") {
        handle_download(req, res);
    } else if (req.url == "/upload") {
        handle_upload(req, res);
    } else {
        res.statusCode = 404;
        res.end();
    }
});

function createData(len) {
    var array = new Array(len);
    for (var i = 0; i < array.length; i++) {
        array[i] = String.fromCharCode(0x30 + Math.floor(Math.random() * 10));
    }
    return array.join('');
}

function download() {
    console.log("downloading");
    var begin = Date.now();
    var lastprint = begin;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/download');
    xhr.responseType = 'blob';
    xhr.addEventListener('progress', function(event) {
        var now = Date.now();
        if (now >= lastprint + 1000) {
            lastprint = now;
            console.log("loaded", event.loaded);
        }
    });
    xhr.addEventListener('load', function() {
        var now = Date.now();
        var elapsed = now - begin;
        var bits = xhr.response.size * 8;
        console.log("elapsed", elapsed, "msec");
        console.log("transferred", bits, "bits");
        console.log("throughput", Math.floor(bits / (elapsed * 1000)), "Mbps");
    });
    xhr.send();
}

function handle_download(req, res) {
    var maxbytes = 1000000000; // about 1GB
    var maxtime = 5000; // about 5sec
    var buf = createData(100000); // about 100KB

    var begin = Date.now();
    var transferred = 0;
    ondrain();

    function ondrain() {
        while (true) {
            var more = res.write(buf);
            transferred += buf.length;
            var now = Date.now();
            var elapsed = now - begin;
            if (transferred >= maxbytes || elapsed >= maxtime) {
                res.end();
                return;
            }
            if (!more) {
                res.once('drain', ondrain);
                return;
            }
        }
    }
}

function upload() {
    var maxbytes = 1000000000; // about 1GB
    var maxtime = 5000; // about 5sec
    var buf = new Blob([createData(1000000)]); // about 1MB

    console.log("uploading");
    var begin = Date.now();
    var lastprint = begin;
    var transferred = 0;
    var finished = false;
    kick();
    kick();

    function kick() {
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', '/upload');
        xhr.responseType = 'text';
        xhr.addEventListener('load', function() {
            if (finished) return;
            var l = Number(xhr.responseText);
            if (l != buf.size) console.error("assertEquals", l, buf.size);
            transferred += buf.size;
            var now = Date.now();
            var elapsed = now - begin;
            if (transferred >= maxbytes || elapsed >= maxtime) {
                var bits = transferred * 8;
                console.log("elapsed", elapsed, "msec");
                console.log("transferred", bits, "bits");
                console.log("throughput", Math.floor(bits / (elapsed * 1000)), "Mbps");
                finished = true;
                return;
            }
            if (now >= lastprint + 1000) {
                lastprint = now;
                console.log("loaded", transferred);
            }
            setTimeout(kick, 0);
        });
        xhr.send(buf);
    }
}

function handle_upload(req, res) {
    var l = 0;
    req.on('data', function(data) {
        l += data.length;
    });
    req.on('end', function() {
        res.end(String(l));
    });
}

function websocket_upload() {
    var maxbytes = 1000000000; // about 1GB
    var maxtime = 5000; // about 5sec
    var buf = new Blob([createData(1000000)]); // about 1MB

    console.log("uploading via websocket");
    var begin = Date.now();
    var lastprint = begin;
    var transferred = 0;
    var socket = new WebSocket((location + "upload").replace("http:", "ws:"));
    socket.addEventListener('open', function(event) {
        begin = Date.now();
        lastprint = begin;
        socket.send(buf);
        socket.send(buf);
    });
    socket.addEventListener('message', function(event) {
        var l = Number(event.data);
        if (l != buf.size) console.error("assertEquals", l, buf.size);
        transferred += l;
        var now = Date.now();
        var elapsed = now - begin;
        if (transferred >= maxbytes || elapsed >= maxtime) {
            var bits = transferred * 8;
            console.log("elapsed", elapsed, "msec");
            console.log("transferred", bits, "bits");
            console.log("throughput", Math.floor(bits / (elapsed * 1000)), "Mbps");
            socket.close();
            return;
        }
        if (now >= lastprint + 1000) {
            lastprint = now;
            console.log("loaded", transferred);
        }
        socket.send(buf);
    });
}

var wss = new WebSocket.Server({
    perMessageDeflate: false,
    server
});

wss.on('connection', function(socket) {
    socket.on('message', function(message) {
        socket.send(String(message.length));
    });
});

server.listen(8765)
