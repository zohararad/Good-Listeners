var Request = {
  /**
   * Sends async XHR using GET
   * @param {String} url - request URL
   * @param {Function} onSuccess - XHR onSuccess callback
   * @param {Function} onFailure - XHR onFailure callback
   */
  get:function(url, onSuccess, onFailure){
    var options = {
      url:url
    };
    // here we build a function to handle success and failure
    // since we can't pass two functions to the postMessage API, we 
    // wrapp the onsuccess / onfailure in a function and execute according to
    // params passed by the XHR object
    var callback = function(response){
      var onsuccess = function(res){
        if(onSuccess){
          onSuccess(res);
        }
      };
      var onfailure = function(res){
        if(onFailure){
          onFailure(res);
        }
      };
      if(response.call === 'success'){
        onsuccess(response.response);
      } else {
        onfailure(response.response);
      }
    }
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.request(options,callback);
    } else {
      chrome.extension.sendRequest({action:'request',params:[options], passCallback:true}, callback);
    }
  },
  /**
   * Sends async XHR using POST
   * @param {String} url - request URL
   * @param {String} params - request params
   * @param {Function} onSuccess - XHR onSuccess callback
   * @param {Function} onFailure - XHR onFailure callback
   */
  post:function(url, params, onSuccess, onFailure){
    var options = {
      url:url,
      method:'post',
      data:params
    };
    var callback = function(response){
      var onsuccess = function(res){
        if(onSuccess){
          onSuccess(res);
        }
      };
      var onfailure = function(res){
        if(onFailure){
          onFailure(res);
        }
      };
      if(response.call === 'success'){
        onsuccess(response.response);
      } else {
        onfailure(response.response);
      }
    }
    if(typeof(Crossrider) !== 'undefined'){
      Crossrider.request(options,callback);
    } else {
      chrome.extension.sendRequest({action:'request',params:[options], passCallback:true}, callback);
    }
  },
  sync: {
    /**
     * Sends sync XHR using GET
     * @param {String} url - request URL
     */
    get:function(url){
      var xhr = new XHR({
        url:url,
        method:'get',
        async:false
      });
      return xhr.send();
    },
    /**
     * Sends sync XHR using POST
   	 * @param {String} params - request params
     * @param {String} url - request URL
     */
    post:function(url,params){
      var xhr = new XHR({
        url:url,
        data:params,
        method:'post',
        async:false
      });
      return xhr.send();
    }
  }
}
