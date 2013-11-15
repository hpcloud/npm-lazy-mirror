var Helpers = {};

Helpers.randomModules = [ 'express', 'supertest', 'mocha', 'hapi'];

Helpers.getRandom = function(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
};

Helpers.getRandomModule = function() {
    return Helpers.randomModules[Helpers.getRandom(0, Helpers.randomModules.length)];
};

Helpers.handleRes = function(err) {
    if (err) {
        throw err;
    }
};

module.exports = Helpers;

