var DOM = {
	/**
   * Adds inline CSS inside a <style> tag to the DOM
   * @param {String} css - CSS string to add
   */
  addInlineCSS:function(css){
    var tag = document.createElement('style');
    tag.setAttribute('type','text/css');
    tag.innerHTML = css;
    document.getElementsByTagName('head')[0].appendChild(tag);
  },
  /**
   * Adds a remote CSS file to the page using <link> tag.
   * @param {String} url - URL of the CSS file to add to the page
   */
  addRemoteCSS:function(url){
    var tag = document.createElement('link');
    tag.setAttribute('rel','stylesheet');
    tag.setAttribute('type','text/css');
    tag.setAttribute('href',url);
    document.getElementsByTagName('head')[0].appendChild(tag);
  },
  /**
   * Adds Javascript to the page inside a <script> tag
   * @param {String} js - Javascript string to add
   */
  addInlineJS:function(js){
    var tag = document.createElement('script');
    tag.setAttribute('type','text/javascript');
    tag.innerHTML = js;
    document.getElementsByTagName('body')[0].appendChild(tag);
  },
  /**
   * Adds a remote Javascript file to the page .
   * @param {String} url - URL of the Javascript file to add to the page
   */
  addRemoteJS:function(url){
    var tag = document.createElement('script');
    tag.setAttribute('type','text/javascript');
    tag.setAttribute('src',url);
    document.getElementsByTagName('body')[0].appendChild(tag);
  },
  /**
   * Calls a function on the current page
   */
  callPageFunction:function(){
  	var func = arguments[0];
  	var parts = [func,'('], params = [];
  	if(arguments.length > 1){
  		for(var i = 1; i < arguments.length; i++){
				var param = arguments[i];
				if(param === undefined) { continue; }
  			if(typeof(param) === 'string'){
  				params.push('"'+param+'"');
  			} else if(typeof(param) === 'object'){
  				params.push(JSON.stringify(param));
  			} else {
  				params.push(param);
  			}
  		}
  	}
  	parts.push(params.join(','));
  	parts.push(')');
    self.location.assign('javascript:'+parts.join(''));
  }
}