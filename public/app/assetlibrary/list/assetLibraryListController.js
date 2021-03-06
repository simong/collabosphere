/**
 * Copyright ©2016. The Regents of the University of California (Regents). All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software and its documentation
 * for educational, research, and not-for-profit purposes, without fee and without a
 * signed licensing agreement, is hereby granted, provided that the above copyright
 * notice, this paragraph and the following two paragraphs appear in all copies,
 * modifications, and distributions.
 *
 * Contact The Office of Technology Licensing, UC Berkeley, 2150 Shattuck Avenue,
 * Suite 510, Berkeley, CA 94720-1620, (510) 643-7201, otl@berkeley.edu,
 * http://ipira.berkeley.edu/industry-info for commercial licensing opportunities.
 *
 * IN NO EVENT SHALL REGENTS BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL,
 * INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF
 * THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF REGENTS HAS BEEN ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * REGENTS SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE
 * SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED
 * "AS IS". REGENTS HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES,
 * ENHANCEMENTS, OR MODIFICATIONS.
 */

(function(angular) {

  'use strict';

  angular.module('collabosphere').controller('AssetLibraryListController', function(assetLibraryFactory, assetLibraryService, me, utilService, $rootScope, $scope, $state) {

    // Make the me object available to the scope
    $scope.me = me;

    // Variable that keeps track of the URL state
    $scope.state = $state;

    // Variable that keeps track of the search options. These are initially derived from the state
    // parameters. These values will be bound to the search directive, which will update them when
    // a user updates any of the input fields
    $scope.searchOptions = {
      'keywords': $state.params.keywords || '',
      'category': parseInt($state.params.category, 10) || '',
      'user': parseInt($state.params.user, 10) || '',
      'type': $state.params.type || ''
    };

    // Variable that keeps track of whether the search component is in the advanced view state. The
    // initial value gets derived from the state parameters that are passed into this controller.
    // The value will be bound to the search directive which will update it when a user switches
    // between simple and advanced search mode
    $scope.isAdvancedSearch = false;
    if ($scope.searchOptions.category || $scope.searchOptions.user || $scope.searchOptions.type) {
      $scope.isAdvancedSearch = true;
    }

    // Variable that keeps track of whether a search is being performed
    $scope.isSearch = false;
    if ($scope.searchOptions.keywords || $scope.searchOptions.category || $scope.searchOptions.user || $scope.searchOptions.type) {
      $scope.isSearch = true;
    }

    // Variable that keeps track of the assets in the list
    $scope.assets = [];
    $scope.list = {
      'page': 0,
      'ready': true
    };

    // Variable that will keep track of the scroll position in the list
    var scrollPosition = 0;

    /**
     * Get the assets for the current course through an infinite scroll
     */
    var getAssets = $scope.getAssets = function() {
      // Keep track of the search options in the parent container's hash to allow
      // for deep linking to a search
      utilService.setParentHash($scope.searchOptions);

      // Indicate that no further REST API requests should be made
      // until the current request has completed
      $scope.list.ready = false;
      assetLibraryFactory.getAssets($scope.list.page, $scope.searchOptions).success(function(assets) {
        $scope.assets = $scope.assets.concat(assets.results);
        // Only request another page of results if the number of items in the
        // current result set is the same as the maximum number of items in a
        // retrieved asset library page
        if (assets.results.length === 10) {
          $scope.list.ready = true;
        }
      });
      // Ensure that the next page is requested the next time
      $scope.list.page++;
    };

    /**
     * Listen for events indicating that a state change is about to take place. At that point,
     * the current scroll position in the list will be cached
     */
    $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {
      if (fromState.name === 'assetlibrarylist' && toState.name === 'assetlibrarylist.item') {
        utilService.getScrollInformation().then(function(scrollInformation) {
          scrollPosition = scrollInformation.scrollPosition;
          // Don't load additional results
          $scope.list.ready = false;
        });
      }
    });

    /**
     * Listen for events indicating that a state change has taken place. At that point,
     * the previous scroll position in the list will be restored
     */
    $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
      if (toState.name === 'assetlibrarylist') {
        // Resize the iFrame the Asset Library is being run in
        utilService.resizeIFrame();
        // Restore the scroll position to the position the list was in previously
        utilService.scrollTo(scrollPosition);
        // Indicate that more results can be loaded
        $scope.list.ready = true;
      }
    });

    /**
     * Listen for events indicating that the user wants to search through the asset library
     */
    $scope.$on('assetLibrarySearchSearch', function(ev, searchOptions) {
      $scope.list.page = 0;
      $scope.assets = [];
      $scope.searchOptions = searchOptions;

      // Determine whether a search is being done
      $scope.isSearch = false;
      if ($scope.searchOptions.keywords || $scope.searchOptions.category || $scope.searchOptions.user || $scope.searchOptions.type) {
        $scope.isSearch = true;
      }

      // Load the list of assets with the specified search options
      getAssets();
    });

    /**
     * Listen for events indicating that an asset has been updated
     */
    $scope.$on('assetLibraryAssetUpdated', function(ev, updatedAsset) {
      for (var i = 0; i < $scope.assets.length; i++) {
        if ($scope.assets[i].id === updatedAsset.id) {
          $scope.assets[i] = updatedAsset;
        }
      }
    });

    /**
     * Listen for events indicating that an asset has been deleted
     */
    $scope.$on('assetLibraryAssetDeleted', function(ev, assetId) {
      $scope.assets = _.reject($scope.assets, {'id': assetId});
    });

  });

}(window.angular));
