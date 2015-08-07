"use strict";

var EventEmitter = require('eventemitter3');
var Dispatcher = require('flux').Dispatcher;
var invariant = require('inv');
var dispatcher = new Dispatcher();

function Payload(source, actionType, data) {
    invariant(typeof source === 'string', 'Argument source must be a string');
    invariant(typeof actionType === 'string', 'Argument actionType must be a string');
    invariant(actionType !== undefined, 'Argument data is required');

    this.actionType = actionType;
    this.source = source;
    this.data = data;
}

function ActionOptions(options) {
    options = options || {};

    invariant(
        options.maxRetries === undefined ||  typeof options.maxRetries === 'number',
        'Options maxRetries must be a number');

    invariant(
        options.timeout === undefined ||  typeof options.timeout === 'number',
        'Options timeout must be a number');

    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 15;
}

function Action(name, options) {
    invariant(typeof name === 'string', 'Argument name must be a string');

    options = new ActionOptions(options);

    this.displayName = name;

    this.dispatch = function dispatch(actionType, payloadData, loopGuard) {
        invariant(
            this.displayName,
            'You are attempting to dispatch %s from action without displayName',
            actionType);

        var payload = new Payload(this.displayName, actionType, payloadData);

        loopGuard = loopGuard || 0;

        // Protect provision action event during dispatching loop
        if (dispatcher.isDispatching()) {
            if (loopGuard > options.maxRetries)
                throw new Error('Can`t dispatch %s action from %s', actionType, this.displayName);

            setTimeout(function() {
                dispatch.call(this, actionType, payload, ++loopGuard);
            }.bind(this), options.timeout);

        } else {
            dispatcher.dispatch(payload);
        }
    };
}

function Store() {
    var isInited = false;
    var isListend = false;
    var handlers = {};
    var chan = new EventEmitter();
    var initFn = this.init;

    function listen () {
        !isListend &&
        this.addListeners &&
        this.addListeners.call(
            this,
            function(actionType, handler) { handlers[actionType] = handler.bind(this); }.bind(this),
            dispatcher.waitFor.bind(dispatcher));

        isListend = true;
    }

    this.dispatchToken = dispatcher.register(function(payload) {
        var fn = handlers[payload.actionType];

        fn && fn(payload);
    });

    this.addChangeListener = function addChangeListener(fn, ctx) {
        chan.on('change', fn, ctx || this);

        return this.removeChangeListener.bind(this, fn);
    };

    this.removeChangeListener = function removeChangeListener(fn) {
        chan.off('change', fn);
    };

    this.emitChange = function emitChange() {
        chan.emit('change');
    };

    this.isInited = function() {
        return isInited;
    };

    this.init = function init() {
        listen.call(this);
        initFn && initFn.apply(this, arguments);
    };

    this.destruct = function destruct() {
        dispatcher.unregister(this.dispatchToken);
        isInited = false;
    };
}

module.exports = {
    Action: Action,
    Store: Store
};