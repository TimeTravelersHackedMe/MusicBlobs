var webdriverio = require('webdriverio');
var webdriver = require('selenium-webdriver');
var jar = require('selenium-server-standalone-jar');
var remoteServer = require('selenium-webdriver/remote').SeleniumServer;
var child = require('child_process').fork;
var firebase = require('firebase');
var config = {
    apiKey: "AIzaSyCki70PKXOKif7Rj8yVeQamIFgWjd_-4t4",
    authDomain: "music-blobs.firebaseapp.com",
    databaseURL: "https://music-blobs.firebaseio.com",
    storageBucket: "music-blobs.appspot.com"
};
var cheerio = require("cheerio");
var request = require("request");
var request = request.defaults({ jar: true });
var firebaseEncode = require('firebase-encode');
var sanitize = require("sanitize-filename");
var fs = require('file-system');
var musicDir = '/var/app/musicblobs/music';
var nodeID3 = require('node-id3');
var gcloud = require('google-cloud')({
    projectId: 'music-blobs',
    keyFilename: '/var/app/musicblobs/gcloud-auth.json'
});
var gcs = gcloud.storage();
var bucket = gcs.bucket('music-blobs.appspot.com');
var options = {
    desiredCapabilities: {
        browserName: 'phantomjs',
        logLevel: 'verbose'
    }
};
if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir);
}
console.log('here2');
var server = new remoteServer(jar.path, {
    port: 4444
})
    .start()
    .then(function () {
console.log('here');
        var client = webdriverio.remote(options);
        var trackInfo;
        var songs = [];
        var downloadLink;
        var mediaLink = '';
        var selfLink = '';
        var hypemAlbumArt = '';
        var app = firebase.initializeApp(config);
        client
            .init()
            .url('https://hypem.com/popular')
            .pause(5000)
            .execute(function () {
                $(document).ajaxComplete(function (e, xhr, settings) {
                    $(e.currentTarget).unbind('ajaxComplete');
                    $.ajax({
                        url: settings.url,
                        type: 'GET',
                        dataType: 'json',
                        success: function (response) {
                            window.returnLink = response.url;
                        }
                    });
                });
            })
            .click('#track-list > .first a.play')
            .pause(3000)
            .execute(function () {
                return window.playList['tracks'][0];
            }).then(function (data) {
                songs.push(data.value);
console.log('here');
            })
            .execute(function () {
                return window.returnLink;
            }).then(function (data) {
                downloadLink = data.value;
            })
            .click('#track-list > .first .track .base-title')
            .pause(5000)
            .execute(function () {
                return $('.section-player .thumb').css('background-image');
            }).then(function (data) {
                var albumArt = data.value;
                albumArt = albumArt.slice(0, -1);
                albumArt = albumArt.slice(4, albumArt.length);
                hypemAlbumArt = albumArt;
            })
            .end()
            .then(function (trackInfo) {
                request('http://hypem.com/popular', function (error, response, body) {

console.log('here000');
                    request('http://hypem.com/playlist/popular/json/json/1/data.js', function (error, response, body) {
                        var data = JSON.parse(body);
                        delete data.version;
                        for (var i in data) {
                            var key = searchSongs(data[i].artist, data[i].title);
                            if (key === 0) {
                                songs[key].album_art = hypemAlbumArt;
                                songs[key].artist = data[i].artist;
                                songs[key].song = data[i].title;
                                if (typeof downloadLink == 'object') {
                                    downloadLink = downloadLink.data;
                                }
                                if (downloadLink.substring(0, 17) === 'http://www.tumblr') {
                                    downloadLink = downloadLink.split("?")[0];
                                }
                                songs[key].src = downloadLink;
                            }
                        }
                        var d = new Date();
                        setTimeout(function () {
                            console.log(songs);
                            return (function () {
                                var numberOne = songs[Object.keys(songs)[0]];
                                var cashMoney = firebaseEncode.encode(numberOne.song + ' ' + numberOne.artist);
                                var nooo = new Date().getTime();
                                firebase.database().ref('theMoney/' + cashMoney).once('value').then(function (snapshot) {
                                    if (snapshot.val() === null) {
                                        // Song currently not part of the money
                                        console.log('NEW SONG, YAY');
                                        downloadSong(numberOne.src, cashMoney, numberOne.song, numberOne.artist, numberOne.album_art);
                                        firebase.database().ref('theMoney/' + cashMoney).set({
                                            src: [numberOne.src],
                                            title: numberOne.song,
                                            artist: numberOne.artist,
                                            art: [numberOne.album_art],
                                            posturl: [numberOne.posturl],
                                            time: [numberOne.time],
                                            id: [nooo],
                                            hours: 1
                                        });
                                    } else {
                                        // Song is already cash money son(g)
console.log('already a song');
                                        console.log(snapshot.val());
                                        firebase.database().ref('theMoney/' + cashMoney).update({
                                            src: addFire(numberOne.src, snapshot.val().src),
                                            title: numberOne.song,
                                            artist: numberOne.artist,
                                            art: addFire(numberOne.album_art, snapshot.val().art),
                                            posturl: addFire(numberOne.posturl, snapshot.val().posturl),
                                            time: addFire(numberOne.time, snapshot.val().time),
                                            id: addHeaven(nooo, snapshot.val().id),
                                            hours: addOne(snapshot.val().hours)
                                        });
                                        console.log('worked!');
setTimeout(function() {process.exit();}, 10000);
                                    }
                                });
                                firebase.database().ref('artists/' + numberOne.artist).once('value').then(function (snapshot) {
                                    if (snapshot.val() === null) {
                                        firebase.database().ref('artists/' + numberOne.artist).set({
                                            songs: [cashMoney]
                                        });
                                    } else {
                                        firebase.database().ref('artists/' + numberOne.artist).set({
                                            songs: addFire(cashMoney, snapshot.val().songs)
                                        });
                                    }
                                });
                            })();
                        }, 24000);
                    });
                });



                function searchSongs(artist, title) {
                    var returnValue = false;
                    for (var i = 0; i < songs.length; i++) {
                        if (songs[i].artist.substring(0, 35) == artist.substring(0, 35) && songs[i].song.substring(0, 35) == title.substring(0, 35)) {
                            returnValue = i;
                        }
                    }
                    return returnValue;
                }

                function getPathFromUrl(url) {
                    return url.split("?")[0];
                }

                function addFire(newStuff, oldStuff) {
                    var oldStuffAsArray = [];
                    for (var key in oldStuff) {
                        oldStuffAsArray.push(oldStuff[key]);
                    }
                    if (oldStuffAsArray.indexOf(newStuff) > -1) {
                        return oldStuff;
                    } else {
                        oldStuffAsArray.unshift(newStuff);
                        return oldStuffAsArray;
                    }
                }

                function addHeaven(newStuff, oldStuff) {
                    var oldStuffAsArray = [];
                    for (var key in oldStuff) {
                        oldStuffAsArray.push(oldStuff[key]);
                    }
                    if (oldStuffAsArray.indexOf(newStuff) > -1) {
                        return oldStuff;
                    } else {
                        oldStuffAsArray.unshift(newStuff);
                        return oldStuffAsArray;
                    }
                }

                function addOne(value) {
                    return value + 1;
                }

                function downloadSong(src, cashMoney, song, title, art) {
                    var mp3RequestOptions = {
                        url: src,
                        timeout: 180000
                    };
                    var mp3Request = request(mp3RequestOptions);
                    mp3Request.on('error', function (error) {
                        console.log('********Problem downloading');
                        console.log('All done. Like it? Donate: https://www.givedirectly.org/give-now');
                    });
                    mp3Request.on('response', function (response) {
                        if (response.statusCode == 200) {
                            mp3Request.pipe(fs.createWriteStream(musicDir + '/' + sanitize(cashMoney + '.mp3')))
                                .on('finish', function () {
                                    console.log('download finished');
                                    injectMeta(cashMoney, song, title, art);
                                });
                        }
                    });
                }

                function injectMeta(cashMoney, song, artist, art) {
                    var albumArtRequestOptions = {
                        url: art,
                        timeout: 10000
                    }
                    if (art !== undefined) {
                        var albumArtRequest = request(albumArtRequestOptions);
                        albumArtRequest.on('error', function (error) {
                            writeMeta(artist, song, musicDir + '/' + sanitize(cashMoney + '.mp3'), musicDir + '/art.jpg', false, cashMoney);
                        });
                        albumArtRequest.on('response', function (response) {
                            if (response.statusCode == 200) {
                                albumArtRequest.pipe(fs.createWriteStream(musicDir + '/' + sanitize(cashMoney + '.jpg')))
                                    .on('finish', function () {
                                        writeMeta(artist, song, musicDir + '/' + sanitize(cashMoney + '.mp3'), musicDir + '/' + sanitize(cashMoney + '.jpg'), true, cashMoney);
                                        uploadArt(cashMoney);
                                    });
                            } else {
                                writeMeta(artist, song, musicDir + '/' + sanitize(cashMoney + '.mp3'), musicDir + '/art.jpg', false, cashMoney);
                            }
                        });
                    } else {
                        writeMeta(artist, song, musicDir + '/' + sanitize(cashMoney + '.mp3'), musicDir + '/art.jpg', false, cashMoney);
                    }
                }

                function uploadSong(cashMoney) {
                    bucket.upload(musicDir + '/' + sanitize(cashMoney + '.mp3'), function (err, file) {
                        console.log(err);
                        console.log(file.metadata);
                        if (!err) {
                            // "zebra.jpg" is now in your bucket. 
                            firebase.database().ref('theMoney/' + cashMoney).update({
                                mediaLink: file.metadata.mediaLink,
                                selfLink: file.metadata.selfLink
                            });
                        }
process.exit();
                    });
                }

                function uploadArt(cashMoney) {
                    bucket.upload(musicDir + '/' + sanitize(cashMoney + '.jpg'), function (err, file) {
                        console.log(err);
                        console.log(file.metadata.mediaLink);
                        if (!err) {
                            // "zebra.jpg" is now in your bucket. 
                            firebase.database().ref('theMoney/' + cashMoney).update({
                                artLink: file.metadata.mediaLink
                            });
                        }
                    });
                }

                function writeMeta(artist, title, fileLocation, albumArt, albumArtBoolean, cashMoney) {
                    var tags = {
                        artist: artist,
                        title: title
                    }
                    if (albumArtBoolean == true) {
                        // Comment out this line if you do not want album art
                        tags.image = albumArt;
                    }
                    var writeTags = nodeID3.write(tags, fileLocation);
                    if (writeTags) {
                        console.log('Tags for ' + title + ' by ' + artist + ' successfully written');
                    } else {
                        console.log('********Tags for ' + title + ' by ' + artist + ' failed to write********');
                    }
                    uploadSong(cashMoney);
                }
            });
    });
