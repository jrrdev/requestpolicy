/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import {Logger} from "content/lib/logger";

// =============================================================================
// DomainUtil
// =============================================================================

export const DomainUtil = {};

/*
 * It's worth noting that many of the functions in this module will
 * convert ACE formatted IDNs to UTF8 formatted values. This is done
 * automatically when constructing nsIURI instances from ACE
 * formatted URIs when the TLD is one in which Mozilla supports
 * UTF8 IDNs.
 */

DomainUtil._idnService = Cc["@mozilla.org/network/idn-service;1"]
    .getService(Ci.nsIIDNService);

const STANDARDURL_CONTRACTID = "@mozilla.org/network/standard-url;1";

// LEVEL_DOMAIN: Use example.com from http://www.a.example.com:81
DomainUtil.LEVEL_DOMAIN = 1;
// LEVEL_HOST: Use www.a.example.com from http://www.a.example.com:81
DomainUtil.LEVEL_HOST = 2;
// LEVEL_SOP: Use http://www.a.example.com:81 from http://www.a.example.com:81
DomainUtil.LEVEL_SOP = 3;

DomainUtil.getIdentifier = function(uri, level) {
  let identifier;
  let identifierGettingFunctionName;

  // We only have one identifier that we're using now:
  //     the pre-path / LEVEL_SOP.
  // TODO: figure out how we want to rename this function and clean up the
  // unused parts.
  level = this.LEVEL_SOP;

  switch (level) {
    case this.LEVEL_DOMAIN:
      identifierGettingFunctionName = "getDomain";
      break;
    case this.LEVEL_HOST:
      identifierGettingFunctionName = "getHost";
      break;
    case this.LEVEL_SOP:
      identifierGettingFunctionName = "getPrePath";
      break;
    default:
    // eslint-disable-next-line no-throw-literal
      throw "Invalid identifier level specified " +
          "in DomainUtil.getIdentifier(): " + level;
  }

  try {
    identifier = this[identifierGettingFunctionName](uri);
  } catch (e) {
    // This will happen not infrequently with chrome:// and similar values
    // for the uri that get passed to this function.
    identifier = false;
  }

  if (identifier) {
    return identifier;
  } else {
    if (uri.indexOf("file://") === 0) {
      return "file://";
    } else if (uri.indexOf("data:") === 0) {
      // Format: data:[<MIME-type>][;charset=<encoding>][;base64],<data>
      identifier = uri.split(",")[0];
      return identifier.split(";")[0];
    }
    Logger.info("Unable to getIdentifier from uri " +
        uri + " using identifier level " + level + ".");
    return uri;
  }
};

/**
 * Returns the hostname from a uri string.
 *
 * @param {nsIURI} aUriObj
 * @return {?string} The hostname of the uri.
 */
DomainUtil.getHostByUriObj = function(aUriObj) {
  try {
    return aUriObj.host;
  } catch (e) {
    return null;
  }
};

/**
 * Returns the hostname from a uri string.
 *
 * @param {string} aUri
 * @return {?string} The hostname of the uri.
 */
DomainUtil.getHost = function(aUri) {
  return DomainUtil.getHostByUriObj(DomainUtil.getUriObject(aUri));
};

/**
 * @param {nsIURI} aUriObj
 * @return {boolean}
 */
DomainUtil.uriObjHasPort = function(aUriObj) {
  try {
    aUriObj.port;
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Returns an nsIURI object from a uri string. Note that nsIURI objects will
 * automatically convert ACE formatting to UTF8 for IDNs in the various
 * attributes of the object that are available.
 *
 * @param {String} uri The uri.
 * @return {nsIURI} The nsIURI object created from the uri, or throws an
 *     exception if it is an invalid uri.
 */
DomainUtil.getUriObject = function(uri) {
  // fixme: if `uri` is relative, `newURI()` throws NS_ERROR_MALFORMED_URI.
  // possible solution: use nsIURI.resolve() instead for relative uris

  // Throws an exception if uri is invalid.
  try {
    return Services.io.newURI(uri, null, null);
  } catch (e) {
    const msg = "DomainUtil.getUriObject exception on uri <" + uri + ">.";
    Logger.log(msg);
    // eslint-disable-next-line no-throw-literal
    throw e;
  }
};

/**
 * Determines whether a uri string represents a valid uri.
 *
 * @param {String} uri The uri.
 * @return {boolean} True if the uri is valid, false otherwise.
 */
DomainUtil.isValidUri = function(uri) {
  try {
    this.getUriObject(uri);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Returns the domain from a uri string.
 *
 * @param {string} uri The uri.
 * @return {?string} The domain of the uri.
 */
DomainUtil.getBaseDomain = function(uri) {
  const host = this.getHost(uri);
  if (host === null) {
    return null;
  }
  try {
    // The nsIEffectiveTLDService functions will always leave IDNs as ACE.
    const baseDomain = Services.eTLD.getBaseDomainFromHost(host, 0);
    // Note: we use convertToDisplayIDN rather than convertACEtoUTF8() because
    // we want to only convert IDNs that that are in Mozilla's IDN whitelist.
    // The second argument will have the property named "value" set to true if
    // the result is ASCII/ACE encoded, false otherwise.
    return DomainUtil._idnService.convertToDisplayIDN(baseDomain, {});
  } catch (e) {
    if (e.name === "NS_ERROR_HOST_IS_IP_ADDRESS") {
      return host;
    } else if (e.name === "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS") {
      return host;
    } else {
      // eslint-disable-next-line no-throw-literal
      throw e;
    }
  }
};

/**
 * Determine whether a hostname is an IP address.
 *
 * @param {String} host
 * @return {Boolean} True if |host| is an IP address rather than a name.
 */
DomainUtil.isIPAddress = function(host) {
  try {
    Services.eTLD.getBaseDomainFromHost(host, 0);
    return false;
  } catch (e) {
    switch (e.name) {
      case "NS_ERROR_HOST_IS_IP_ADDRESS":
        return true;

      case "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS":
        return false;

      default:
        console.error("Unexpected error:", e);
        return false;
    }
  }
};

/**
 * Returns the path from a uri string.
 *
 * @param {String} uri The uri.
 * @return {String} The path of the uri.
 */
DomainUtil.getPath = function(uri) {
  return this.getUriObject(uri).path;
};

/**
 * Returns the prePath from a uri string. Note that this will return
 * a prePath in UTF8 format for all IDNs, even if the uri passed to
 * the function is ACE formatted.
 *
 * @param {String} uri The uri.
 * @return {String} The prePath of the uri.
 */
DomainUtil.getPrePath = function(uri) {
  return this.getUriObject(uri).prePath;
};

DomainUtil.stripFragment = function(uri) {
  return uri.split("#")[0];
};

// TODO: Maybe this should have a different home.
/**
 * Gets the relevant pieces out of a meta refresh or header refresh string.
 *
 * @param {String} refreshString The original content of a refresh
 *     header or meta tag.
 * @return {Object} The delay in seconds and the url to refresh to.
 *     The url may be an empty string if the current url should be
 *     refreshed.
 * @throws Generic exception if the refreshString has an invalid format,
 *     including if the seconds can't be parsed as a float.
 */
DomainUtil.parseRefresh = function(refreshString) {
  const parts = /^\s*(\S*?)\s*(;\s*url\s*=\s*(.*?)\s*)?$/i.exec(refreshString);
  const delay = parseFloat(parts[1]);
  if (isNaN(delay)) {
    // eslint-disable-next-line no-throw-literal
    throw "Invalid delay value in refresh string: " + parts[1];
  }
  let url = parts[3];
  if (url === undefined) {
    url = "";
  }
  // Strip off enclosing quotes around the url.
  if (url) {
    const first = url[0];
    const last = url[url.length - 1];
    if (first === last && (first === "'" || first === "\"")) {
      url = url.substring(1, url.length - 1);
    }
  }
  return {delay: delay, destURI: url};
};

/**
 * Adds a path of "/" to the uri if it doesn't have one. That is,
 * "http://127.0.0.1" is returned as "http://127.0.0.1/". Will return
 * the origin uri if the provided one is not valid.
 *
 * @param {String} uri
 * @return {String}
 */
DomainUtil.ensureUriHasPath = function(uri) {
  try {
    return this.getUriObject(uri).spec;
  } catch (e) {
    return uri;
  }
};

/**
 * Returns the same uri but makes sure that it's UTF8 formatted
 * instead of ACE formatted if it's an IDN that Mozilla supports
 * displaying in UTF8 format. See
 * http://www.mozilla.org/projects/security/tld-idn-policy-list.html
 * for more info.
 *
 * @param {String} uri The uri.
 * @return {nsIURI} The same uri but with UTF8 formatting if the original uri
 *     was ACE formatted.
 */
DomainUtil.formatIDNUri = function(uri) {
  // Throws an exception if uri is invalid. This is almost the same as the
  // ensureUriHasPath function, but the separate function makes the calling
  // code clearer and this one we want to raise an exception if the uri is
  // not valid.
  return this.getUriObject(uri).spec;
};

/**
 * Given an origin URI string and a destination path to redirect to, returns a
 * string which is a valid uri which will be/should be redirected to. This
 * takes into account whether the destPath is a full URI, an absolute path
 * (starts with a slash), a protocol relative path (starts with two slashes),
 * or is relative to the originUri path.
 *
 * @param {String} originUri
 * @param {String} destPath
 * @return {String}
 */
DomainUtil.determineRedirectUri = function(originUri, destPath) {
  const baseUri = this.getUriObject(originUri);
  const urlType = Ci.nsIStandardURL.URLTYPE_AUTHORITY;
  const newUri = Cc[STANDARDURL_CONTRACTID].createInstance(Ci.nsIStandardURL);
  newUri.init(urlType, 0, destPath, null, baseUri);
  // eslint-disable-next-line new-cap
  const resolvedUri = newUri.QueryInterface(Ci.nsIURI);
  return resolvedUri.spec;
};

/**
 * Determines whether a URI uses the standard port for its scheme.
 *
 * @param {nsIURI} uri
 * @return {Boolean}
 */
DomainUtil.hasStandardPort = function(uri) {
  // A port value of -1 in the uriObj means the default for the protocol.
  return uri.port === -1 ||
         uri.scheme !== "http" && uri.scheme !== "https" ||
         uri.port === 80 && uri.scheme === "http" ||
         uri.port === 443 && uri.scheme === "https";
};

DomainUtil.getDefaultPortForScheme = function(scheme) {
  switch (scheme) {
    case "http":
      return 80;
    case "https":
      return 443;
    default:
      Logger.warn("Unknown default port for scheme " + scheme + ".");
      return null;
  }
};
