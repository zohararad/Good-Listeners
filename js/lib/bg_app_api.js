var AppApi = function(){};

AppApi.prototype = {
  request: Request,
  time: Time,
  db: DB,
  /**
   * Initialize the App API content script
   */
  init:function(cookies){
  	this.appID = Crossrider.appID;
    this.cr_version = Crossrider.manifest.version;
    this.version = Crossrider.manifest.ver;
    this.platform = Crossrider.manifest.platform;
    this._cookies = cookies;
    this.manifest = Crossrider.manifest;
    this.db.init(this);
    this.cookie = new Cookie(this);
    this.push = new Push(this);
    this.chrome = new ChromeAPI(this);
	this.browserAction = this.chrome.browserAction;
    this.message = new Message();
    this.analytics = new Analytics(this);
    this.debug = new Debugger();
    this.installer = new Installer(this);
  },
  dom:{
  	/**
	   * Adds inline CSS inside a <style> tag to the DOM
	   * @param {String} css - CSS string to add
	   */
	  addInlineCSS:function(css){
	    chrome.tabs.getSelected(null, function(tab) {
			if (!tab) return;
	      chrome.tabs.sendRequest(tab.id, {action: 'addInlineCSS', params:[css]}, function() {});
	    });
	  },
	  /**
	   * Adds a remote CSS file to the page using <link> tag.
	   * @param {String} url - URL of the CSS file to add to the page
	   */
	  addRemoteCSS:function(url){
	    chrome.tabs.getSelected(null, function(tab) {
			if (!tab) return;
	      chrome.tabs.sendRequest(tab.id, {action: 'addRemoteCSS', params:[url]}, function() {});
	    });
	  },
	  /**
	   * Adds Javascript to the page inside a <script> tag
	   * @param {String} js - Javascript string to add
	   */
	  addInlineJS:function(js){
	    chrome.tabs.getSelected(null, function(tab) {
			if (!tab) return;
	      chrome.tabs.sendRequest(tab.id, {action: 'addInlineJS', params:[js]}, function() {});
	    });
	  },
	  /**
	   * Adds a remote Javascript file to the page .
	   * @param {String} url - URL of the Javascript file to add to the page
	   */
	  addRemoteJS:function(url){
	    chrome.tabs.getSelected(null, function(tab) {
			if (!tab) return;
	      chrome.tabs.sendRequest(tab.id, {action: 'addRemoteJS', params:[url]}, function() {});
	    });
	  }
  },
  /**
   * Opens a new URL specified by 'url' in a current/new tab or new window
   * Calls Crossrider.openURL on background page.
   * @param {String} url - URL to open
   * @param {String} where - where to open the URL (current / new tab or new window). Possible values are: 'current', 'tab', 'window'
   */
  openURL:function(url,where){
    Crossrider.openURL(url,where);
  },
  /**
   * Alerts a string 'str' by calling Crossrider.superAlert on background page
   * @param {String} str - string to alert
   */
  superAlert:function(str){
    Crossrider.superAlert(str);
  },
  /**
   * Updates a cookie with given value and expiration date;
   * Called from background page whenever a cookie is updated
   * @param {String} name - cookie name to update
   * @param {Object} cookie - cookie value and expiration object
   */
  updateCookie:function(name,cookie){
    var exp = cookie.expires instanceof(Date) ? cookie.expires : new Date(cookie.expires);
    this._cookies[name] = {value:cookie.value,expires:exp};
  },
  
  /**
   * Removes a cookie from the internal cookies object. Called either by the Cookie object or by the background page
   * in case a cookie was removed in a different tab.
   * @param {String} name - name of cookie to remove
   */
  unsetCookie:function(name){
    if(this._cookies[name]){
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
    var exp = cookie.expires instanceof(Date) ? cookie.expires : new Date(cookie.expires);
    this._cookies.mysite[name] = {value:cookie.value,expires:exp};
  },
  /**
   * Removes a cookie from the internal browser cookies object. Called when a browser cookie was removed in a different tab.
   * @param {String} name - name of cookie to remove
   */
  unsetRealCookie:function(name){
    if(this._cookies.mysite[name]){
      delete this._cookies.mysite[name];
    }
  },
  /**
   * Calls a function on the current page
   * @param {String} func - function name to call
   */
  callPageFunction:function(func){
    document.location.apply('javascript:'+func+'()');
  },
  /**
   * Checks if we're in debug mode or not
   * @returns {Boolean} - whether debug mode is enabled or not
   */
  isDebugMode:function(){
  	return Crossrider.debug;
  },
  /**
   * Returns the Crossrider platform unique ID
   * @returns {String} Crossrider platform unique ID
   */
  getCrossriderID:function(){
  	return Crossrider._bic;
  },
  
  /**
   * Background page API
   */
  background:{
  	/**
  	 * Reload the background page
  	 */
  	reload:function(){
  		Crossrider.reload();
  	}
  }
};
