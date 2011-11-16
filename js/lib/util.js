/**
 * Mimic MooTools' basic Class behaviour.
 * Adds a Class function to the page that receives an object of methods and 
 * properties and returns an instanciable function.
 * @param {Object} defs - object containing class definitions
 */

var Class = function(defs){
  return function(){
    for(var d in defs){
      if(defs.hasOwnProperty(d)){
        this[d] = defs[d];
      }
    }
    if(typeof(this['initialize']) === 'function'){
      this.initialize.apply(this,arguments);
    }
  }
}

/**
 * XHR Class.
 * Generic handler for ajax requests.
 */
var XHR = new Class({
  /**
   * Initialize the XHR object
   * @param {Object} options
   *  url {String} - request URL
   *  method {String} - request method
   *  data {String} - request data query string
   *  type {String} - request type (xml / text) Default to text.
   *  async {Boolean} - make syncronous or asyncronous requests
   *  callback {Function} - request onsuccess / onfailure callback
   */
  initialize:function(options){
    this.options = options;
    this._method = (this.options.method || 'get').toUpperCase();
    this._data = this.options.data || null;
    this._type = options.type || 'text';
    this._xhr = new XMLHttpRequest();
    this._xhr.open(this._method, this.options.url, this.options.async);
    if(this._method === 'POST'){
    	this._xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }
    return this;
  },
  /**
   * XHR onreadystage change handler
   * Handles XHR life-cycle. In case of async requests onsuccess / onfailure callbacks will be called.
   * In case of sync requests, response / response status will be returned in success / failure respectively
   * Note that onsuccess / onfailure callbacks are handled internally inside the 'callback' function passed to
   * the object due to the postMessage callback limitation
   */
  _onReadyStateChange:function(){
    if(this._xhr.readyState === 4){
      if(this._xhr.status === 200 || (!this._async && this._xhr.status === 0)){
        var response = this._xhr[this._type === 'xml' ? 'responseXML' : 'responseText'];
        if(this.options.async && this.options.callback){
          this.options.callback({call:'success',response:response});
        } else {
          return response;
        }
      } else {
        if(this.options.async && this.options.callback){
          this.options.callback({call:'failure',response:this._xhr.status});
        } else {
        	var url = this.options.url, status = this._xhr.status;
			  	if(typeof(Crossrider) !== 'undefined' && Crossrider.debug){
	        	chrome.windows.getLastFocused(function(win){
							if(win.type === 'popup' && (win.tabs === undefined || win.tabs.length === 0)){
								return;
							}
					    chrome.tabs.getSelected(win.id, function(tab) {
							if (!tab) return;
					    	chrome.tabs.executeScript(tab.id,{code:"(function(){throw new Error('loading "+url+" failed with status "+status+"');})();"});
					    });
				  	});
				  	throw new Error('loading '+url+' failed with status '+status);
			  	}
          return null;
        }
      }
    }
  },

	_handleSendException:function(e) {
		var errMsg = "XHR EXCEPTION: " + e.message + ", CODE: " + e.code + 
			"\nURL: " + this.options.url + ", METHOD: " + this.options.method + ", IS ASYNC: " + this.options.async;
		console.log(errMsg);
	},

  /**
   * Sends the AJAX request
   */
  send:function(){
	if(this.options.async){
		try {
      		this._xhr.onreadystatechange = this._onReadyStateChange.bind(this);
      		this._xhr.send(this._data);
		} catch(e) {
			this.options.callback({call:'failure', response: 599});
			this._handleSendException(e);
		}
    } else {
		try {
			this._xhr.send(this._data);
		} catch (e) {
			this._handleSendException(e);
			return null;
		}
	    return this._onReadyStateChange();
    }
  }
});
