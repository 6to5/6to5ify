var assign   = require("object-assign");
var stream   = require("stream");
var babel    = require("babel-core");
var util     = require("util");
var path     = require("path");
var includes = require("lodash/includes");

function arrayify(val, mapFn) {
  if (!val) return [];
  if (typeof val === "boolean") return arrayify([val], mapFn);
  if (typeof val === "string") return arrayify(val.split(","), mapFn);

  if (Array.isArray(val)) {
    if (mapFn) val = val.map(mapFn);
    return val;
  }

  return [val];
}

module.exports = Babelify;
util.inherits(Babelify, stream.Transform);

function Babelify(filename, opts) {
  if (!(this instanceof Babelify)) {
    return Babelify.configure(opts)(filename);
  }

  stream.Transform.call(this);
  this._data = "";
  this._filename = filename;
  this._opts = assign({filename: filename}, opts);
}

Babelify.prototype._transform = function (buf, enc, callback) {
  this._data += buf;
  callback();
};

Babelify.prototype._flush = function (callback) {
  try {
    var result = babel.transform(this._data, this._opts);
    this.emit("babelify", result, this._filename);
    var code = result.code;
    this.push(code);
  } catch(err) {
    this.emit("error", err);
    return;
  }
  callback();
};

Babelify.configure = function (opts) {
  opts = assign({}, opts);
  var extensions = opts.extensions ? arrayify(opts.extensions) : babel.DEFAULT_EXTENSIONS;
  var sourceMapsAbsolute = opts.sourceMapsAbsolute;
  if (opts.sourceMaps !== false) opts.sourceMaps = "inline";

  // babelify specific options
  delete opts.sourceMapsAbsolute;
  delete opts.extensions;
  delete opts.filename;

  // babelify backwards-compat
  delete opts.sourceMapRelative;

  // browserify specific options
  delete opts._flags;
  delete opts.basedir;
  delete opts.global;

  // browserify cli options
  delete opts._;
  // "--opt [ a b ]" and "--opt a --opt b" are allowed:
  if (opts.ignore && opts.ignore._) opts.ignore = opts.ignore._;
  if (opts.only && opts.only._) opts.only = opts.only._;
  if (opts.plugins && opts.plugins._) opts.plugins = opts.plugins._;
  if (opts.presets && opts.presets._) opts.presets = opts.presets._;

  return function (filename) {
    var extension = path.extname(filename);

    if (!includes(extensions, extension)) {
      return stream.PassThrough();
    }

    var _opts = sourceMapsAbsolute
      ? assign({sourceFileName: filename}, opts)
      : opts;

    return new Babelify(filename, _opts);
  };
};
