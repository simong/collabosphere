/*!
 * Copyright 2015 UC Berkeley (UCB) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

(function(angular) {

  'use strict';

  angular.module('collabosphere').service('utilService', function($location, $q, $timeout) {

    // Hide the vertical toolbar when the tool is embedded in an iFrame. At that point, the scrolling
    // script injected in the parent window will ensure that the iFrame is always as high as its content
    // TODO: Whiteboards are currently excluded from this rule as there is an element below the whiteboard
    // that takes up space. This should be fixed and whiteboards should follow this rule
    if (top != self || $location.path().indexOf('/whiteboards/') !== -1) {
      document.body.classList.add('embedded');
    }

    // Cache the API domain and Course ID that were passed in through
    // the iFrame launch URL. These variables need to be used to construct
    // the base URL for all REST API requests
    var apiDomain = $location.search().api_domain;
    var courseId = $location.search().course_id;
    var toolUrl = $location.search().tool_url;

    /**
     * Get the parameters that were passed in through the iFrame launch URL
     *
     * @return {Object}                       The parameters that were passed in through the iFrame launch URL
     */
    var getLaunchParams = function() {
      var launchParams = {
        'apiDomain': apiDomain,
        'courseId': courseId,
        'toolUrl': toolUrl
      };
      return launchParams;
    };

    /**
     * Construct the full URL for a REST API request. All REST API requests should
     * be of the form `/api/<apiDomain>/<courseId>/<restAPI>`
     *
     * @param  {String}       url             The REST API for which the full REST API URL should be constructed
     * @return {String}                       The full REST API URL of the form `/api/<apiDomain>/<courseId>/<restAPI>`
     */
    var getApiUrl = function(url) {
      return '/api/' + apiDomain + '/' + courseId + url;
    };

    /**
     * Get the external tool URL for the current LTI tool placement
     */
    var getToolUrl = function() {
      return toolUrl;
    };

    /**
     * Adjust the height of the current iFrame to the size of its content.
     * This will only happen when Collabosphere is embedded as an LTI tool in
     * a different application
     */
    var resizeIFrame = function() {
      postIFrameMessage(function() {
        var height = document.body.offsetHeight;
        return {
          'subject': 'changeParent',
          'height': height
        };
      });
    };

    // Continuously check if there have been any changes to the content of the page
    // and resize accordingly
    setInterval(resizeIFrame, 250);

    /**
     * Scroll to the top of the window. When Collabosphere is being run stand-alone,
     * it will scroll the current window to the top. When Collabosphere is being run
     * as a BasicLTI tool, it will scroll the parent window to the top
     */
    var scrollToTop = function() {
      // Always scroll the current window to the top
      window.scrollTo(0, 0);
      // When running Collabosphere as a BasicLTI tool, also scroll
      // the parent window to the top
      postIFrameMessage(function() {
        return {
          'subject': 'changeParent',
          'scrollToTop': true
        };
      });
    };

    /**
     * Scroll the window to a specified position. When Collabosphere is being run stand-alone,
     * it will scroll the current window to the specified position. When Collabosphere is being run
     * as a BasicLTI tool, it will scroll the parent window to the specified position
     *
     * @param  {Number}           position            The vertical scroll position to scroll to
     */
    var scrollTo = function(position) {
      // When running Collabosphere as a BasicLTI tool, scroll the parent window
      if (window.parent) {
        postIFrameMessage(function() {
          return {
            'subject': 'changeParent',
            'scrollTo': position
          };
        });
      // Otherwise, scroll the current window
      } else {
        window.scrollTo(0, position);
      }
    };

    /**
     * Get the current scroll information. When Collabosphere is being run stand-alone,
     * it will return the scroll position of the current window. When Collabosphere is being run
     * as a BasicLTI tool, it will return the scroll information of the parent window
     *
     * @return {Promise<Object>}                      Promise returning the current scroll information
     */
    var getScrollInformation = function() {
      var deferred = $q.defer();
      // When running Collabosphere as a BasicLTI tool, request the scroll position of the parent window
      if (window.parent) {
        postIFrameMessage(function() {
          return {
            'subject': 'getScrollInformation'
          };
        }, function(response) {
          deferred.resolve(response);
        });
      // Otherwise, retrieve the scroll information of the current window
      } else {
        var scrollPosition = (window.pageYOffset || document.documentElement.scrollTop) - (document.documentElement.clientTop || 0);
        var scrollToBottom =  document.body.offsetHeight - scrollPosition - document.documentElement.clientHeight;
        deferred.resolve({
          'scrollPosition': scrollPosition,
          'scrollToBottom': scrollToBottom
        });
      }
      return deferred.promise;
    };

    /**
     * Utility function used to send a window event to the parent container. When running
     * Collabosphere as a BasicLTI tool, this is our main way of communicating with the container
     * application
     *
     * @param  {Function}   messageGenerator                          Function that will return the message to send to the parent container
     * @param  {Function}   [messageCallback]                         Function that will be called when a response from the parent container has been received
     * @param  {Number}     [messageCallback.currentIframeHeight]     The height of the LTI iFrame
     * @param  {Number}     [messageCallback.currentParentHeight]     The full height of the parent container
     * @param  {Number}     [messageCallback.currentScrollPosition]   The scroll position within the parent container
     * @param  {Number}     [messageCallback.scrollToBottom]          The distance between the bottom of the browser and the bottom of the page
     * @api private
     */
    var postIFrameMessage = function(messageGenerator, messageCallback) {
      // Only try to send the event when a parent container is present
      if (window.parent) {
        // Wait until Angular has finished rendering items on the screen
        $timeout(function() {
          // The parent container will respond with a message into the current window containing
          // the scroll information of the parent window
          if (messageCallback) {
            var callback = function(ev) {
              if (ev && ev.data) {
                var message;
                try {
                  message = JSON.parse(ev.data);
                } catch (err) {
                  // The message is not for us; ignore it
                  return;
                }
                if (message) {
                  messageCallback(message);
                }
                window.removeEventListener('message', callback);
              }
            };
            window.addEventListener('message', callback);
          }

          // Retrieve the message to send to the parent container. Note that we can't pass the
          // message directly into this function, as we sometimes need to wait until Angular has
          // finished rendering before we can determine what message to send
          var message = messageGenerator();
          // Send the message to the parent container as a stringified object
          window.parent.postMessage(JSON.stringify(message), '*');
        });
      }
    };

    return {
      'getLaunchParams': getLaunchParams,
      'getApiUrl': getApiUrl,
      'getToolUrl': getToolUrl,
      'getScrollInformation': getScrollInformation,
      'resizeIFrame': resizeIFrame,
      'scrollTo': scrollTo,
      'scrollToTop': scrollToTop
    };

  });

}(window.angular));
