var _ = require('lodash');
var Async = require('async');
var Fs = require('fs');
var Mkdirp = require('mkdirp');
var Path = require('path');
var Url = require('url');

/**
 * Simple cache get/set operations for disk ops
 *
 * @constructor
 * @param {Object} opts - the main server config object
 * @returns {Cache}
 */
var Cache = function(opts) {

    if (!this instanceof Cache) {
        return new Cache(opts);
    }

    if (!opts) { return new Error('Options object not supplied'); }
    if (!opts.cache_dir) { return new Error('Cache directory not supplied'); }

    this.cache_dir = opts.cache_dir;
    this.meta_folder = 'meta';
    this.tgz_folder = 'tgz';

    this.config = opts;

    return this;
};

/**
 * Checks if the requested resource is valid
 *
 * @param {Object} opts - type, name, version
 * @callback cb - (err, bool)
 */
Cache.prototype.exists = function(opts, cb) {

    if (!opts.type) { return cb(new Error('Type not supplied')); }
    if (!opts.name) { return cb(new Error('Name not supplied')); }
    if (!opts.version) { opts.version = ''; }

    var path;
    var cache = this;

    if (opts.type === 'meta') {
        path = this.getMetaPath(opts.name);

    } else if (opts.type === 'tgz') {
        path = this.getTarballPath(opts.name, opts.version);

    } else {
        return cb(new Error('Unknown type: ' + opts.type));
    }

    Fs.exists(path, function(exists) {
        if (!exists) { return cb(null, exists); }

        Fs.stat(path, function(err, stats) {

            if (err) { return cb (err); }
            var now = Date.now();
            var mtime = stats.mtime.getTime();

            if ( (now - mtime) >= cache.config.cache_expiry ) {
                return cb(null, false);
            }

            return cb(null, true);
        });
    });

};

/**
 * Overrides all the dist/tarball keys in the package metadata to point
 * to this mirror.
 *
 * @param {Object} pkg_json - The package metadata
 * @callback cb - (err, new_json)
 */
Cache.prototype.overrrideTarballUrls = function(pkg_json, cb) {

    var cache = this;

    var changeDistUrl = function(ver, done) {
        ver = pkg_json.versions[ver];
        if (ver.dist && ver.dist.tarball) {
            var dist_url = Url.parse(ver.dist.tarball);
            dist_url.host = null;
            dist_url.hostname = cache.config.server_address;
            dist_url.port = cache.config.server_port;
            ver.dist.tarball = Url.format(dist_url);
            done();
        } else {
            done();
        }
    };

    if (!pkg_json.versions) { return cb(null, pkg_json); }

    Async.each(Object.keys(pkg_json.versions), changeDistUrl, function(err) {
        return cb(err, pkg_json);
    });

};

/**
 * Sets the metadata for a package
 *
 * @param {string} pkg - The package name
 * @param {Object} meta - The original package metadata
 * @callback cb - (err, pkg_json)
 */
Cache.prototype.setMeta = function(pkg, meta, cb) {
    var cache = this;
    var path = this.getMetaPath(pkg);
    var dir = Path.dirname(path);
    var pkg_json;

    Async.series([
        function(done) {
            Mkdirp(dir, done);
        },
        function(done){
            Fs.writeFile(path + '.orig', JSON.stringify(meta), done);
        },
        function(done) {
            cache.overrrideTarballUrls(meta, function(err, json){
                if (err) { return done(err); }
                pkg_json = json;
                done();
            });
        },
        function(done) {
            Fs.writeFile(path, JSON.stringify(pkg_json), done);
        }
    ], function(err) {
        cb(err, pkg_json);
    });
};


/**
 * Sets the metadata for a specific package version
 *
 * @param {Object} pkg - The package (./lib/package) object
 * @param {Object} meta - The original package metadata
 * @callback cb - (err)
 */
Cache.prototype.setMetaVersion = function(pkg, meta, cb) {
    var path = this.getMetaVersionPath(pkg.name, pkg.version);
    var dir = Path.dirname(path);

    Mkdirp(dir, function(err) {
        if (err) { return cb(err); }
        Fs.writeFile(path, JSON.stringify(meta), cb);
    });

};

/**
 * Gets the metadata filepath for a package
 *
 * @param {string} pkg - The package name
 * @returns {string}
 */
Cache.prototype.getMetaPath = function(name) {
    return Path.join(this.cache_dir, name, this.meta_folder, name + '.json');
};

/**
 * Gets the metadata filepath for a specific package version
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @returns {string}
 */
Cache.prototype.getMetaVersionPath = function(name, version) {
    return Path.join(this.cache_dir, name, this.meta_folder, name + '-' + version + '.json');
};

/**
 * Async wrapper for getMetaPath
 *
 * @param {string} pkg - The package name
 * @callback (err, path)
 */
Cache.prototype.getMeta = function(name, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    return cb(null, this.getMetaPath(name));
};

/**
 * Async wrapper for getMetaVersionPath
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @callback (err, path)
 */
Cache.prototype.getMetaVersion = function(name, version, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    if (!version) { return cb(new Error('Version not supplied')); }

    return cb(null, this.getMetaVersionPath(name, version));
};


/**
 * Gets the path to the tarball for a specific package version
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @returns {string}
 */
Cache.prototype.getTarballPath = function(name, version) {
    return Path.join(this.cache_dir, name, this.tgz_folder, name + '-' + version + '.tgz');
};

/**
 * Async wrapper for getTarballPath
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @callback (err, path)
 */
Cache.prototype.getTarball = function(name, version, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    if (!version) { return cb(new Error('Version not supplied')); }

    return cb(null, this.getTarballPath(name, version));

};

module.exports = Cache;
