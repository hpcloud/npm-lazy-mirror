var Helpers = require('./helpers');

var HOST = process.env.TEST_HOST || 'localhost';
var PORT = process.env.TEST_PORT || 2000;

var request = require('supertest');

request = request('http://' + HOST + ':' + PORT);

describe('GET /', function(){
    it('respond with json', function(done) {
        request.get('/')
        .set('Accept', 'application/json')
        .expect(200)
        .expect(/registry/, done);
    });
});

describe('GET /express', function(){
    it('responds 200', function(done) {
        request.get('/express')
        .set('Accept', 'application/json')
        .expect(200, done);
    });
});

describe('GET /express/latest', function(){
    it('respond 200 with Cache-Control header', function(done) {
        request.get('/express/latest')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Cache-Control', /max-age/, done);
    });
});

describe('GET /express/3.4.4', function(){
    it('gets the express 3.4.4 metadata', function(done) {
        request.get('/express/3.4.4')
        .expect(200)
        .expect('Cache-Control', /max-age/, done);
    });
});

describe('GET /multiparty/2.2.0', function(){
    it('responds 200 for the multiparty 2.2.0 metadata', function(done) {
        request.get('/multiparty/2.2.0')
        .expect(200)
        .expect('Cache-Control', /max-age/, done);
    });
});

describe('GET /multiparty/-/multiparty-2.2.0.tgz', function(){
    it('gets the multiparty 2.2.0 tarball', function(done) {

        this.timeout(10000);

        request.get('/multiparty/-/multiparty-2.2.0.tgz')
        .expect(200)
        .expect('Cache-Control', /max-age/)
        .expect('Content-Type', /application\/octet-stream/, done);
    });
});

describe('GET /multiparty/-/multiparty-2.222.0.tgz (fetch tarball)', function(){
    it('404 response on non-existing tarball', function(done) {
        request.get('/multiparty/-/multiparty-2.222.0.tgz')
        .expect(404, done);
    });
});

describe('GET //does/not/exist', function(){
    it('responds 404 on non-existing package', function(done) {
        request.get('//does/not/exist')
        .expect(404, done);
    });
});


describe('GET /doesnotexist', function(){
    it('responds 404 on non-existing package', function(done) {
        request.get('/doesnotexists')
        .expect(404, done);
    });
});
var randomModule = Helpers.getRandomModule();

describe('GET /' + randomModule, function(){
    it('returns a random module metadata', function(done) {
        request.get('/' + randomModule)
        .expect(200, done);
    });
});


