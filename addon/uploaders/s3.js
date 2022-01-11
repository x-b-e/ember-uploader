import { set, get } from '@ember/object';
import Uploader from 'ember-uploader/uploaders/uploader';
import { Promise } from 'rsvp';
import { run } from '@ember/runloop';

export default Uploader.extend({
  /**
   * Target url used to request a signed upload policy
   *
   * @property url
   */
  signingUrl: '/sign',

  /**
   * request method for signing
   *
   * @property method
   */
  signingMethod: 'GET',

  /**
   * Boolean property changed to true upon signing start and false upon
   * signing end
   *
   * @property isSigning
   */
  isSigning: false,

  /**
   * Request signed upload policy and upload file(s) and any extra data
   *
   * @param  {object} file  A file object
   * @param  {object} extra Extra data to be sent with the upload
   * @return {object} Returns a Ember.RSVP.Promise wrapping the signing
   * request object
   */
  upload(file, extra = {}) {
    return this.sign(file, extra).then((json) => {
      let url;

      set(this, 'isUploading', true);

      if (json.endpoint) {
        url = json.endpoint;
        delete json.endpoint;
      } else if (json.region) {
        url = `https://s3-${json.region}.amazonaws.com/${json.bucket}`;
        delete json.region;
      } else {
        url = `https://${json.bucket}.s3.amazonaws.com`;
      }

      return this.ajax(url, this.createFormData(file, json));
    });
  },

  /**
   * Request signed upload policy
   *
   * @param  {object} file  A file object
   * @param  {object} extra Extra data to be sent with the upload
   * @return {object} Returns a Ember.RSVP.Promise wrapping the signing
   * request object
   */
  sign(file, extra = {}) {
    const url    = get(this, 'signingUrl');
    const method = get(this, 'signingMethod');
    const signingAjaxSettings = get(this, 'signingAjaxSettings.headers');

    extra.name = file.name;
    extra.type = file.type;
    extra.size = file.size;

    const data = method.match(/get/i) ? extra : JSON.stringify(extra)

    const xhr = new XMLHttpRequest()
    xhr.open(method, url, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    Object.keys(signingAjaxSettings).forEach((key) => {
      xhr.setRequestHeader(key, signingAjaxSettings[key])
    })

    set(this, 'isSigning', true);

    return new Promise((resolve, reject) => {
      xhr.onload = () => {
        var json = xhr.response
        run(null, resolve, this.didSign(json));
      };

      xhr.onerror = (jqXHR, responseText, errorThrown) => {
        run(null, reject, this.didErrorOnSign(jqXHR, responseText, errorThrown));
      };

      xhr.send(data)
    });
  },

  /**
   * Triggers didErrorOnSign event and sets isSigning to false
   *
   * @param {object} jqXHR jQuery XMLHttpRequest object
   * @param {string} textStatus The status code of the error
   * @param {object} errorThrown The error caused
   * @return {object} Returns the jQuery XMLHttpRequest
   */
  didErrorOnSign(jqXHR, textStatus, errorThrown) {
    set(this, 'isSigning', false);
    this.trigger('didErrorOnSign');
    this.didError(jqXHR, textStatus, errorThrown);
    return jqXHR;
  },

  /**
   * Triggers didSign event and returns the signing response
   *
   * @param {object} response The signing response
   * @return {object} The signing response
   */
  didSign(response) {
    this.trigger('didSign', response);
    return response;
  }
});
