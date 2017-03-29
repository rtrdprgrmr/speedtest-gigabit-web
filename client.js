#!/usr/bin/env node

/*
Copyright (c) 2017 rtrdprgrmr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var http = require('http');
var url = require('url');
var WebSocket = require('ws');

var URL = process.argv[3];

switch (URL && process.argv[2]) {
    case 'download':
        download();
        break;
    case 'upload':
        upload();
        break;
    case 'websocket_upload':
        websocket_upload();
        break;
    default:
        console.log("usage: " + process.argv[1] + " download|upload|websocket_upload URL");
        break;
}

function createData(len) {
    var array = new Array(len);
    for (var i = 0; i < array.length; i++) {
        array[i] = String.fromCharCode(0x30 + Math.floor(Math.random() * 10));
    }
    return array.join('');
}

function download() {
    console.log("downloading", URL);
    var begin = Date.now();
    var lastprint = begin;
    var transferred = 0;

    http.get(url.parse(url.resolve(URL, "/download")), function(res) {
        res.on('data', function(data) {
            transferred += data.length;
            var now = Date.now();
            if (now >= lastprint + 1000) {
                lastprint = now;
                console.log("loaded", transferred);
            }
        });
        res.on('end', function() {
            var elapsed = Date.now() - begin;
            var bits = transferred * 8;
            console.log("elapsed", elapsed, "msec");
            console.log("transferred", bits, "bits");
            console.log("throughput", Math.floor(bits / (elapsed * 1000)), "Mbps");
        });
    });
}

function upload() {
    var maxbytes = 1000000000; // about 1GB
    var maxtime = 5000; // about 5sec
    var buf = createData(100000); // about 100KB

    console.log("uploading", URL);
    var begin = Date.now();
    var lastprint = begin;
    var transferred = 0;

    var options = url.parse(url.resolve(URL, "/upload"));
    options.method = "PUT";
    var req = http.request(options, function(res) {
        var body = '';
        res.on('data', function(data) {
            body += data.toString();
        });
        res.on('end', function() {
            var l = Number(body);
            if (l != transferred) console.error("assertEquals", l, transferred);
            var now = Date.now();
            var elapsed = now - begin;
            var bits = transferred * 8;
            console.log("elapsed", elapsed, "msec");
            console.log("transferred", bits, "bits");
            console.log("throughput", Math.floor(bits / (elapsed * 1000)), "Mbps");
        });
    });
    ondrain();

    function ondrain() {
        while (true) {
            var more = req.write(buf);
            transferred += buf.length;
            var now = Date.now();
            var elapsed = now - begin;
            if (transferred >= maxbytes || elapsed >= maxtime) {
                req.end();
                return;
            }
            if (now >= lastprint + 1000) {
                lastprint = now;
                console.log("loaded", transferred);
            }
            if (!more) {
                req.once('drain', ondrain);
                return;
            }
        }
    }
}

function websocket_upload() {
    var maxbytes = 1000000000; // about 1GB
    var maxtime = 5000; // about 5sec
    var buf = createData(100000); // about 100KB

    console.log("uploading via websocket");
    var begin = Date.now();
    var lastprint = begin;
    var transferred = 0;
    var socket = new WebSocket(url.resolve(URL, "/upload").replace("http:", "ws:"));
    socket.on('open', function(event) {
        begin = Date.now();
        lastprint = begin;
        socket.send(buf);
        socket.send(buf);
    });
    socket.on('message', function(data) {
        var l = Number(data);
        if (l != buf.length) console.error("assertEquals", l, buf.length);
        transferred += l;
        var now = Date.now();
        var elapsed = now - begin;
        if (transferred >= maxbytes || elapsed >= maxtime) {
            var elapsed = Date.now() - begin;
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
