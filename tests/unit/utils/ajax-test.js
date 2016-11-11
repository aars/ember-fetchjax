import Ajax from 'ember-fetchjax/utils/ajax';
import { module, test } from 'qunit';
import jQuery from 'jquery';
import sinon from 'sinon';

module('Unit | Utility | ajax', {
  beforeEach() {
    this.sandbox = sinon.sandbox.create();
    this.server = this.sandbox.useFakeServer();
    this.server.xhr.useFilters = true;
    this.server.autoRespond = true;
    this.subject = new Ajax({ajax: jQuery.ajax});
  },
  afterEach() {
    this.sandbox.restore();
    delete this.sandbox;
    delete this.subject;
    delete this.server;
  }
});

test('#_ajax handles 5xx (Server Error)', function(assert) {
  assert.expect(3);
  const done = assert.async();
  this.server.respondWith('GET', '/posts', [500, {}, ""]);
  let promise = this.subject.ajax('/posts', { method: 'GET' }, false);
  assert.ok(typeof promise.then === 'function', 'returns a thenable');
  promise.catch(function(error) {
    assert.equal(error.name, 'ServerError', '5xx response throws a custom error');
    assert.equal(error.code, 500, 'error code 500');
    done();
  });
});

test('#_ajax handles 4xx (Client Error)', function(assert) {
  assert.expect(5);
  const done = assert.async();
  this.server.respondWith('GET', '/posts/101', [
    404,
    {'Content-Type':'application/vnd.api+json'},
    JSON.stringify({
      "errors": [{
        "title": "Record not found",
        "detail": "The record identified by 101 could not be found.",
        "code": 404,
        "status": "not_found"
      }]
    })
  ]);
  let promise = this.subject.ajax('/posts/101', { method: 'GET' }, false);
  assert.ok(typeof promise.then === 'function', 'returns a thenable');
  promise.catch(function(error) {
    assert.ok(error.name, 'Client Error', '4xx response throws a custom error');
    assert.ok(Array.isArray(error.errors), '4xx error includes errors');
    assert.equal(error.errors[0].code, 404, '404 error code is in errors list');
    assert.equal(error.code, 404, 'error code 404');
    done();
  });
});

test('#_ajax handles 3xx error', function(assert) {
  assert.expect(3);
  const done = assert.async();
  this.server.respondWith('GET', '/posts', [302, {}, ""]);
  let promise = this.subject.ajax('/posts', { method: 'GET' }, false);
  assert.ok(typeof promise.then === 'function', 'returns a thenable');
  promise.catch(function(error) {
    assert.equal(error.name, 'FetchError', 'unknown error response throws a custom error');
    assert.equal(error.code, 302, '302 error code');
    done();
  });
});

test('#_ajax handles 204 (Success, no content)', function(assert) {
  assert.expect(2);
  const done = assert.async();
  this.server.respondWith('PATCH', '/posts/101', [204, {}, ""]);
  let promise = this.subject.ajax('/posts/101', { method: 'PATCH', body: 'json string here' }, false);
  assert.ok(typeof promise.then === 'function', 'returns a thenable');
  promise.then(function(res) {
    assert.equal(res, "", 'No content in the response');
    done();
  });
});

test('#_ajax handles 200 (Success) response status', function(assert) {
  assert.expect(3);
  const done = assert.async();
  this.server.respondWith('GET', '/posts/101', [
    200, {'Content-Type':'application/vnd.api+json'}, JSON.stringify({
      data: { id: 101, attributes: { name: 'Yo Post' }}
    })
  ]);
  this.subject.deserialize = function(res) { return res.data; };
  this.subject.cacheResponse = this.sandbox.spy();
  let promise = this.subject.ajax('/posts/101', { method: 'GET' }, false);
  assert.ok(typeof promise.then === 'function', 'returns a thenable');
  promise.then(function(res) {
    assert.equal(res.id, 101, 'has data content in the response');
    assert.ok(this.subject.cacheResponse.calledOnce, '#cacheResource method called');
    done();
  }.bind(this));
});

test('#_getAjaxHeaders', function(assert) {
  let jqXHR = {
    getAllResponseHeaders: function() {
      let resHdr = "Content-Type: application/vnd.api+json\n";
      resHdr += "Cache-Control: max-age=0, private, must-revalidate\n";
      return resHdr;
    }
  };
  let headers = this.subject._getAjaxHeaders(jqXHR);
  assert.equal(headers['Content-Type'], 'application/vnd.api+json', 'JSAON API header ok');
  assert.equal(headers['Cache-Control'], 'max-age=0, private, must-revalidate', 'Catch control header ok');
});
