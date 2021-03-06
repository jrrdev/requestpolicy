/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

// =============================================================================
// JSUtils
// =============================================================================

export const JSUtils = (function() {
  let self = {};

  self.arrayIncludes = function(array, searchElement) {
    for (let element of array) {
      if (element === searchElement) {
        return true;
      }
    }
    return false;
  };

  self.defineLazyGetter = function(aOnObj, aKey, aValueFn) {
    Object.defineProperty(aOnObj, aKey, {
      get: function() {
        delete aOnObj[aKey];
        let value = aValueFn.call(aOnObj);
        Object.defineProperty(aOnObj, aKey, {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
        return value;
      },
      configurable: true,
      enumerable: true,
    });
  };

  self.leftRotateArray = function(array, n) {
    n = n % array.length;
    let firstPart = array.slice(0, n);
    let secondPart = array.slice(n);
    return [].concat(secondPart, firstPart);
  };

  /**
   * Create an array containing the elements [0, ..., n-1].
   *
   * @param {number} n
   * @return {Array<number>}
   */
  self.range = function(n) {
    let array = [];
    for (let i = 0; i < n; i++) {
      array.push(i);
    }
    return array;
  };

  return self;
})();
