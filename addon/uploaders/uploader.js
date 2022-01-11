import { Promise } from 'rsvp';
import Evented from '@ember/object/evented';
import EmberObject, { set, get } from '@ember/object';
import { run } from '@ember/runloop';

export default EmberObject.extend(Evented, {
  /**
   * Target url to upload to
   *
   * @property url
   */
  url: null,

  /**
   * ajax request method, by default it will be POST
   *
   * @property method
   */
  method: 'POST',

  /**
   * Used to define a namespace for the file param and any extra data params
   * that may be sent
   *
   * @property paramNamespace
   */
  paramNamespace: null,

  /**
   * The parameter name for the file(s) to be uploaded
   *
   * @property paramName
   */
  paramName: 'file',

  /**
   * Boolean property changed to true upon upload start and false upon upload
   * end
   *
   * @property isUploading
   */
  isUploading: false,

  /**
   * Start upload of file(s) and any extra data
   *
   * @param  {object|array} files  One file object or one array of files object
   * @param  {object} extra Extra data to be sent with the upload
   * @return {object} Returns a Ember.RSVP.Promise wrapping the ajax request
   * object
   */
  upload (files, extra = {}) {
    const data   = this.createFormData(files, extra);
    const url    = get(this, 'url');
    const method = get(this, 'method');

    set(this, 'isUploading', true);

    return this.ajax(url, data, method);
  },

  /**
   * Creates the FormData object with the file(s) and any extra data
   *
   * @param {object|array} files One file object or an array of file objects
   * @param {object} extra Extra data to be sent with the upload
   * @return {object} Returns a FormData object with the supplied file(s) and
   * extra data
   */
  createFormData (files, extra = {}) {
    const formData = new FormData();

    for (const prop in extra) {
      if (extra.hasOwnProperty(prop)) {
        formData.append(this.toNamespacedParam(prop), extra[prop]);
      }
    }

    // if is a array of files ...
    if (files.constructor === FileList || files.constructor === Array) {
      const paramKey = `${this.toNamespacedParam(this.paramName)}[]`;

      for (let i = 0; i < files.length; i++) {
        // FormData expects the key for arrays to be postfixed with empty
        // brackets This same key is used each time a new item is added.
        formData.append(paramKey, files[i]);
      }
    } else {
      // if has only one file object ...
      formData.append(this.toNamespacedParam(this.paramName), files);
    }

    return formData;
  },

  /**
   * Returns the param name namespaced if a namespace exists
   *
   * @param {string} name The param name to namespace
   * @return {string} Returns the namespaced param
   */
  toNamespacedParam (name) {
    return this.paramNamespace ?
      `${this.paramNamespace}[${name}]` :
      name;
  },

  /**
   * Triggers didUpload event with given params and sets isUploading to false
   *
   * @param {object} data Object of data supplied to the didUpload event
   * @return {object} Returns the given data
   */
  didUpload (data) {
    set(this, 'isUploading', false);
    this.trigger('didUpload', data);
    return data;
  },

  /**
   * Triggers didError event with given params and sets isUploading to false
   *
   * @param {object} jqXHR jQuery XMLHttpRequest object
   * @param {string} textStatus The status code of the error
   * @param {object} errorThrown The error caused
   * @return {object} Returns the jQuery XMLHttpRequest
   */
  didError (jqXHR, textStatus, errorThrown) {
    set(this, 'isUploading', false);

    // Borrowed from Ember Data
    const isObject = jqXHR !== null && typeof jqXHR === 'object';

    if (isObject) {
      jqXHR.then = null;
      if (!jqXHR.errorThrown) {
        if (typeof errorThrown === 'string') {
          jqXHR.errorThrown = new Error(errorThrown);
        } else {
          jqXHR.errorThrown = errorThrown;
        }
      }
    }

    this.trigger('didError', jqXHR, textStatus, errorThrown);

    return jqXHR;
  },

  /**
   * Triggers progress event supplying event with current percent
   *
   * @param {object} event Event from xhr onprogress
   */
  didProgress (event) {
    event.percent = event.loaded / event.total * 100;
    this.trigger('progress', event);
  },

  /**
   * Triggers isAborting event and sets isUploading to false
   */
  abort () {
    set(this, 'isUploading', false);
    this.trigger('isAborting');
  },

  /**
   * Starts a request to the given url sending the supplied data using the
   * supplied request method
   *
   * @param {string} url The target url for the request
   * @param {object} data The data to send with the request
   * @param {string} method The request method
   * @return {object} Returns a Ember.RSVP.Promise wrapping the ajax request
   * object
   */
  ajax (url, data = {}, method = this.method) {
    const httpReq = new XMLHttpRequest
    
    httpReq.open(method, url, true)
    
    const ajaxSettings = get(this, 'ajaxSettings.headers')
    
    Object.keys(ajaxSettings).forEach((key) => {
      httpReq.setRequestHeader(key, ajaxSettings[key])
    })
    
    return this.ajaxPromise(httpReq, data);
  },

  /**
   * Starts a request using the supplied settings returning a
   * Ember.RSVP.Promise wrapping the ajax request
   *
   * @param {object} settings The jQuery.ajax compatible settings object
   * @return {object} Returns a Ember.RSVP.Promise wrapping the ajax request
   */
  ajaxPromise (xhr, data) {
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", function(evt) {
        this.didProgress(evt)
      })
      this.one('isAborting', () => xhr.abort());

      xhr.onload = () => {
        var json = xhr.response
        run(null, resolve, this.didUpload(json));
      };

      xhr.onerror = (jqXHR, responseText, errorThrown) => {
        run(null, reject, this.didError(jqXHR, responseText, errorThrown));
      };

      xhr.send(data)
    });
  }
});
