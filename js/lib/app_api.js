var AppApi = function(){};

AppApi.prototype = {
  _dom:{},
  _faye:{
    callbacks:{},
    asyncCallbacks:{}
  },
  _removedCookies:{},
  request: Request,
  time: Time,
  dom:DOM,
  db: DB,
  /**
   * Initialize the App API content script
   */
  init:function(){
    this.cookie = new Cookie(this);
    this.push = new Push(this);
    this.chrome = new ChromeAPI(this);
	this.browserAction = this.chrome.browserAction;
    this.analytics = new Analytics(this);
    this.message = new Message();
    this.installer = new Installer(this);
    this._initInternalMessaging();
    this._getUserScripts();
  },
  /**
   * Initialize internal messaging event handling.
   */
  _initInternalMessaging:function(){
    chrome.extension.onRequest.addListener(this._onRequest.bind(this));
  },
  /**
   * Sends a message to the background page to retrieve the extensions user scripts.
   */
  _getUserScripts:function(){
  	chrome.extension.sendRequest({action:'getAppID',passCallback:true},function(appID){
  		var stub = document.getElementById('crossrider-app-stub'+appID);
  		if(stub === null){
  			var div = document.createElement('div');
  			div.id = 'crossrider-app-stub'+appID;
  			document.getElementsByTagName('body')[0].appendChild(div);
		    chrome.extension.sendRequest({action:'addUserScripts'}, function(){});
  		}
  	});
  },
  /**
   * Handles messages from the background page.
   * Looks for an internal method that corresponds to @param request.action.
   * If such method is found, it will be executed, with @param.request.params passed as arguments
   * 
   * @param {Object} request - Request data object. holding data passed from the sender
   * @param {Object} sender - Request sender reference
   * @param {Function} sendResponse - callback to execute when the request is received
   */
  _onRequest:function(request, sender, sendResponse){
    var action = request['action'];
    if(action && typeof(this[action]) === 'function'){
      var params = request['params'] && typeof(request['params']['push']) === 'function' ? request['params'] : [];
      if(request.passCallback === true){
        params.push(sendResponse);
      }
      this[action].apply(this,params);
    }
    if(!request.passCallback && sendResponse && typeof(sendResponse) === 'function'){
      sendResponse();
    }
  },
  /**
   * Initializes the content script.
   * Adds user CSS to the document and adds a local copy of the cookie store
   * @param {Array} styles - list of CSS files to add to the document
   * @param {Objec} cookies - copy of background page cookies object
   * @param {String} tabID - content script's tab ID
   * @param {String} bic - extension unique ID for stats on the crossrider server
   * @param {Object} manifest - extension's manifest object
   */
  initContentScript:function(styles,cookies,tabID,bic,manifest){
    styles.forEach(function(url){
      this.dom.addRemoteCSS(url);
    }.bind(this));
    this.tabID = tabID;
    this.manifest = manifest;
    this.appID = manifest.crossrider.appID;
    this.cr_version = manifest.version;
    this.version = manifest.ver;
    this.platform = manifest.platform;
    this.debugMode = manifest.crossrider.debug;
    this._cookies = JSON.parse(cookies);
    this.db.init(this);
    this.debug = new Debugger(this);
    this.message.setTabId(tabID);
    this.fbAPI = new FacebookAPI(this);
    this.asyncAPI = AsyncAPI.init(this);
    if(bic){
	    this._bic = bic;
    } else {
    	chrome.extension.sendRequest({action:'setToolbarUniqueID',params:[], passCallback:true}, function(bic){
    		this._bic = bic;
    	}.bind(this));
    }
  },
  /**
   * Opens a new URL specified by 'url' in a current/new tab or new window
   * Calls Crossrider.openURL on background page.
   * @param {String} url - URL to open
   * @param {String} where - where to open the URL (current / new tab or new window). Possible values are: 'current', 'tab', 'window'
   */
  openURL:function(url,where){
    chrome.extension.sendRequest({action:'openURL',params:[url,where]}, function(){});
  },
  /**
   * Alerts a string 'str' by calling Crossrider.superAlert on background page
   * @param {String} str - string to alert
   */
  superAlert:function(str){
    chrome.extension.sendRequest({action:'superAlert',params:[str]}, function(){});
  },
  /**
   * Updates a cookie with given value and expiration date;
   * Called from background page whenever a cookie is updated
   * @param {String} name - cookie name to update
   * @param {Object} cookie - cookie value and expiration object
   */
  updateCookie:function(name,cookie){
  	if(this._removedCookies[name]){
		delete this._removedCookies[name];		
  	} else {
	    this._cookies[name] = {value:cookie.value,expires:cookie.expires};
  	}
  },
  
  /**
   * Removes a cookie from the internal cookies object. Called either by the Cookie object or by the background page
   * in case a cookie was removed in a different tab.
   * @param {String} name - name of cookie to remove
   */
  unsetCookie:function(name){
    if(this._cookies[name]){
    	this._removedCookies[name] = true;
      delete this._cookies[name];
    }
  },
  /**
   * Updates a browser cookie with given value and expiration date;
   * Called from background page whenever a browser cookie is updated
   * @param {String} name - cookie name to update
   * @param {Object} cookie - cookie value and expiration object
   */
  updateRealCookie:function(name,cookie){
  	if(this._removedCookies['real'+name]){
  		delete this._removedCookies['real'+name];
  	} else {
	    this._cookies.mysite[name] = {value:cookie.value,expires:cookie.expires};
  	}
  },
  /**
   * Removes a cookie from the internal browser cookies object. Called when a browser cookie was removed in a different tab.
   * @param {String} name - name of cookie to remove
   */
  unsetRealCookie:function(name){
    if(this._cookies.mysite[name]){
    	this._removedCookies['real'+name] = true;
      delete this._cookies.mysite[name];
    }
  },
  /**
   * Handles response from the Faye messaging server.
   * This is a catch-all function called by the background page when a message arrives to a channel
   * on the Faye server. If a callback for the channel has been subsribed it will be executed.
   * 
   * @param {String} channel - channel on which the message was received
   * @param {String} msg - msg received on the channel
   * @param {Boolean} async - if set to true, call is made on behalf of async API rather than appAPI
   */
  respond:function(channel,msg,async){
  	var obj = async ? 'asyncCallbacks' : 'callbacks';
    if(this._faye[obj][channel]){
      this._faye[obj][channel](msg);
    }
  },
  /**
   * Checks if we're in debug mode or not
   * @returns {Boolean} - whether debug mode is enabled or not
   */
  isDebugMode:function(){
  	return this.debugMode;
  },
  /**
   * Returns the Crossrider platform unique ID
   * @returns {String} Crossrider platform unique ID
   */
  getCrossriderID:function(){
  	return this._bic;
  },
  /**
   * Handles responses from the facebook api bridge
   * @param {String} action - facebook api action that was performed
   * @param {String} response - facebook api response JSON-formatted string
   */
  fb_respond:function(action,response){
  	this.fbAPI.callback(action,response);
  },
  /**
   * Handles messages from other tabs or from background page
   */
  handleMessage:function(msg){
  	this.message.call(msg);
  },
  
  /**
   * Background page API
   */
  background:{
  	/**
  	 * Reload the background page
  	 */
  	reload:function(){
  		chrome.extension.sendRequest({action:'reload'}, function(){});
  	}
  },
  
  /** AppAPI Utility Functions **/
  
  /**
   * Returns an object with information about the appAPI:
   * 	appID, cr_version, version, platform
   */
  getAPIInfo:function(){
  	return  {
			appID:this.appID,
			cr_version:this.cr_version,
			version:this.version,
			platform:this.platform
		}
  },
  /**
   * Provide your callback and get the text that was selected
   *
   * @param {Function} callback - function to trigger at the event of text selection. Function should get the selected text and the jquery event param (e / evt)
   * @param {Objct} options: 
   *    - element {DOMElement} - what element to activate the selection on. could be either jquery object or a string selector (jquery format). if omitted then will use 'body' (all page) to trigger the event
   *    - minlength {Number} - what is the min length of characters to trigger the event
   *    - maxlength {Number} - what is the max length of characters to trigger the event
   */
  selectedText:function(callback, options) {
    
    function getSelectedText() {
      if(window.getSelection) {
        return window.getSelection();
      }
      else if(document.getSelection) {
        return document.getSelection();
      } else {
        var selectedText = document.selection && document.selection.createRange();
        if(selectedText.text) {
          return selectedText.text;
        }
        return false;
      }
      return false;
    }
    
    if (callback == null) {
      this.debug("selectedText: no callback function provided.");
      return;     
    }
    if (options == null){
      options = {}
    }
    options.lastSelection = "";
    
    options.minlength = options.minlength || 1;
    options.maxlength = options.maxlength || 99999999;
    
    var jqueryObj;
    switch(typeof(options.element)) {
      case "undefined":
        jqueryObj = $jquery('body');
        break;
      case "object":
        if (options.element instanceof jQuery) {
          jqueryObj = options.element;                    
        } else {
          this.debug("selectedText: element provided as an unrecorgnize object.");
          return;
        }
        break;
      case "string":
        jqueryObj = $jquery(options.element);
        break;
      default:
        this.debug("selectedText: unknown element.");
        return;
    }
    
    jqueryObj.mouseup(function(e){
      //get the text selected
      var q = getSelectedText();
      //check it's not the same selection (when clicking again on the selected text)
      if (q && String(q) == options.lastSelection) {
        options.lastSelection = "";
        return;
      } else {
        options.lastSelection = String(q);
      }
        //check limit      
      if (q && String(q).length >= options.minlength && String(q).length <= options.maxlength) {
        callback(q, e);
      }
    });
  },
  
  /**
   * Provide event handler for keyboard shortcuts
   * Strongly recommended to read: http://www.openjs.com/scripts/events/keyboard_shortcuts/
   * Shortcut generator: http://jonathan.tang.name/files/js_keycode/test_keycode.html
   * 
   * http://www.openjs.com/scripts/events/keyboard_shortcuts/
   * Version : 2.01.B
   * By Binny V A
   * License : BSD
   */
  shortcut:{
    'all_shortcuts':{},//All the shortcuts are stored in this array
    'add': function(shortcut_combination,callback,opt) {
      //Provide a set of default options
      var default_options = {
        'type':'keydown',
        'propagate':false,
        'disable_in_input':false,
        'target':document,
        'keycode':false
      }
      if(!opt){
        opt = default_options
      } else {
        for(var dfo in default_options) {
          if(typeof(opt[dfo]) === 'undefined'){
            opt[dfo] = default_options[dfo];
          }
        }
      }

      var ele = opt.target;
      if(typeof(opt.target) === 'string') {
         ele = document.getElementById(opt.target);
      }
      var ths = this;
      shortcut_combination = shortcut_combination.toLowerCase();

      //The function to be called at keypress
      var func = function(e) {
        e = e || window.event;

        if(opt['disable_in_input']) { //Don't enable shortcut keys in Input, Textarea fields
          var element;
          if(e.target){
            element = e.target;
          } else if(e.srcElement){
            element = e.srcElement;
          }
          if(element.nodeType === 3){
            element = element.parentNode;
          }

          if(element.tagName == 'INPUT' || element.tagName == 'TEXTAREA'){
            return;
          }
        }

        //Find Which key is pressed
        if (e.keyCode){
          code = e.keyCode;
        } else if (e.which){
          code = e.which;
        }
        var character = String.fromCharCode(code).toLowerCase();

        if(code == 188) character=","; //If the user presses , when the type is onkeydown
        if(code == 190) character="."; //If the user presses , when the type is onkeydown

        var keys = shortcut_combination.split("+");
        //Key Pressed - counts the number of valid keypresses - if it is same as the number of keys, the shortcut function is invoked
        var kp = 0;

        //Work around for stupid Shift key bug created by using lowercase - as a result the shift+num combination was broken
        var shift_nums = {
          "`":"~",
          "1":"!",
          "2":"@",
          "3":"#",
          "4":"$",
          "5":"%",
          "6":"^",
          "7":"&",
          "8":"*",
          "9":"(",
          "0":")",
          "-":"_",
          "=":"+",
          ";":":",
          "'":"\"",
          ",":"<",
          ".":">",
          "/":"?",
          "\\":"|"
        }
        //Special Keys - and their codes
        var special_keys = {
          'esc':27,
          'escape':27,
          'tab':9,
          'space':32,
          'return':13,
          'enter':13,
          'backspace':8,

          'scrolllock':145,
          'scroll_lock':145,
          'scroll':145,
          'capslock':20,
          'caps_lock':20,
          'caps':20,
          'numlock':144,
          'num_lock':144,
          'num':144,

          'pause':19,
          'break':19,

          'insert':45,
          'home':36,
          'delete':46,
          'end':35,

          'pageup':33,
          'page_up':33,
          'pu':33,

          'pagedown':34,
          'page_down':34,
          'pd':34,

          'left':37,
          'up':38,
          'right':39,
          'down':40,

          'f1':112,
          'f2':113,
          'f3':114,
          'f4':115,
          'f5':116,
          'f6':117,
          'f7':118,
          'f8':119,
          'f9':120,
          'f10':121,
          'f11':122,
          'f12':123
        }

        var modifiers = { 
          shift: { wanted:false, pressed:false},
          ctrl : { wanted:false, pressed:false},
          alt  : { wanted:false, pressed:false},
          meta : { wanted:false, pressed:false} //Meta is Mac specific
        };

        if(e.ctrlKey){
          modifiers.ctrl.pressed = true;
        }
        if(e.shiftKey){
          modifiers.shift.pressed = true;
        }
        if(e.altKey){
          modifiers.alt.pressed = true;
        }
        if(e.metaKey){
          modifiers.meta.pressed = true;
        }

        for(var i=0; k=keys[i],i<keys.length; i++) {
          //Modifiers
          if(k == 'ctrl' || k == 'control') {
            kp++;
            modifiers.ctrl.wanted = true;
          } else if(k == 'shift') {
            kp++;
            modifiers.shift.wanted = true;
          } else if(k == 'alt') {
            kp++;
            modifiers.alt.wanted = true;
          } else if(k == 'meta') {
            kp++;
            modifiers.meta.wanted = true;
          } else if(k.length > 1) { //If it is a special key
            if(special_keys[k] == code) kp++;
          } else if(opt['keycode']) {
            if(opt['keycode'] == code) kp++;
          } else { //The special keys did not match
            if(character == k){
              kp++;
            } else {
              if(shift_nums[character] && e.shiftKey) { //Stupid Shift key bug created by using lowercase
                character = shift_nums[character]; 
                if(character == k){
                  kp++;
                }
              }
            }
          }
        }

        if(kp == keys.length && 
              modifiers.ctrl.pressed == modifiers.ctrl.wanted &&
              modifiers.shift.pressed == modifiers.shift.wanted &&
              modifiers.alt.pressed == modifiers.alt.wanted &&
              modifiers.meta.pressed == modifiers.meta.wanted) {
          callback(e);

          if(!opt['propagate']) { //Stop the event
            //e.cancelBubble is supported by IE - this will kill the bubbling process.
            e.cancelBubble = true;
            e.returnValue = false;

            //e.stopPropagation works in Firefox.
            if (e.stopPropagation) {
              e.stopPropagation();
              e.preventDefault();
            }
            return false;
          }
        }
      }
      this.all_shortcuts[shortcut_combination] = {
        'callback':func, 
        'target':ele, 
        'event': opt['type']
      };
      //Attach the function with the event
      if(ele.addEventListener){
        ele.addEventListener(opt['type'], func, false);
      }
      else if(ele.attachEvent){
        ele.attachEvent('on'+opt['type'], func);
      } else {
        ele['on'+opt['type']] = func;
      }
    },

    //Remove the shortcut - just specify the shortcut and I will remove the binding
    'remove':function(shortcut_combination) {
      shortcut_combination = shortcut_combination.toLowerCase();
      var binding = this.all_shortcuts[shortcut_combination];
      delete(this.all_shortcuts[shortcut_combination])
      if(!binding) { return; }
      var type = binding['event'];
      var ele = binding['target'];
      var callback = binding['callback'];

      if(ele.detachEvent){
        ele.detachEvent('on'+type, callback);
      }
      else if(ele.removeEventListener){
        ele.removeEventListener(type, callback, false);
      } else {
        ele['on'+type] = false;
      }
    }
  },
  
  /*
  Lets the developer specify which pages the app should be executed on.
  
  Usage
  -----
  You should call this function in your first line of the code inside jquery.ready function:
  
  appAPI.matchPages(RulePattern)
  RulePattern = Use DOS's astericks to match any char. i.e *.google.com/*
  
  For Example:
  if (!appAPI.matchPages("*.google.com/*")) return;
  * will match all google.com's pages on any of its sub-domains.
  
  if you want to match multiple pages then add more parameters, such as:
  if (!appAPI.matchPages("*.google.com/*", "google.com/*", "*.twitter.com/*", "twitter.com/*")) return;
  * this will match for all google and twitter pages (with or without subdomains)
  
  note: if you want to exclude pages then use it this way:
  if (appAPI.matchPages("*.google.com/*")) return;
  * this will quit the app if you are on google's pages
  
  You can also pass regular expressions:
  if (!appAPI.matchPages(/^http\:\/\/twitter\.com/, /^t.*\.com/)) return;
  * This will match all pages starting with t and twitter.com itslef of course.
  
  */
  matchPages:function() {
    var matches = false;
    for( var i = 0; i < arguments.length; i++ ) {
      var match_rule = arguments[i];
      var does_it_match = false;
      if (typeof(match_rule) == 'string') {
        match_rule = match_rule.replace(/\./, "\\.").replace(/\*/, ".*");
        var regexp_string = "^http.?\\:\\/\\/" + match_rule;
        var match_reg = new RegExp(regexp_string);
        does_it_match = document.location.href.match(match_reg) ? true : false;                        
      } else if (typeof(match_rule) == 'object') {
        does_it_match = document.location.href.match(match_rule) ? true : false; 
      }
      matches = matches || does_it_match;
      if (matches){
        break;
      }
    }
    return matches;
  } 
};

var appAPI = new AppApi();
appAPI.init();
$jquery = $$jquery.noConflict();