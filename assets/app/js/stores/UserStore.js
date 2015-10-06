var AppDispatcher = require('../AppDispatcher');
var AppConstants = require('../AppConstants');
var ObjectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var CHANGE_EVENT = 'change';

var _store = {
    user_id: null,
    jwt: null,
    email: null
};

// Public API.
// Defines the public event listeners and getters that
// the views will use to listen for changes and retrieve
// the store
var UserStore = ObjectAssign( {}, EventEmitter.prototype, {

    addChangeListener: function(callback) {
        this.on(CHANGE_EVENT, callback);
    },
    removeChangeListener: function(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    },
    getUser: function() {
        return _store;
    },
    getJwt: function() {
        return _store.jwt;
    }
});


// Register each of the actions with the dispatcher
// by changing the store's data and emitting a change
AppDispatcher.register(function(payload) {
    var action = payload.action;

    switch(action.actionType) {
        case AppConstants.UPDATE_USER_STORE:
            _store = action.store;
            UserStore.emit(CHANGE_EVENT);
            break;
        default:
            return true;
    }
});

module.exports = UserStore;