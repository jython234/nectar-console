// UTILITY METHODS ----------------------------------------------------------------------------------------------
//const URL_PREFIX = "/";
const URL_PROTOCOL = "http";
const SERVER_ADDR = "localhost";
const SERVER_PORT = "8080";

const URL_PREFIX = URL_PROTOCOL + "://" + SERVER_ADDR + ":" + SERVER_PORT + "/";

const API_VERSION_MAJOR = "3";
var API_VERSION_MINOR = "3";

var SERVER_SOFTWARE = "Unknown";
var SERVER_SOFTWARE_VERSION = "Unknown";

function doInitalRequest() {
    $.get(
        URL_PREFIX + 'nectar/api/infoRequest'
    ).done(function(data, status, xhr) {
        var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);

        if(json["apiVersionMajor"] != API_VERSION_MAJOR) {
            $('#noticeAlert').hide();
            $('#warnAlert').hide();
            $('#failureAlert').show();

            document.getElementById("failureAlertText").innerHTML = "Server [Major] API version (" +
                        json["apiVersionMajor"] + ") does not match ours (" + API_VERSION_MAJOR + ")";
            return;
        } else if(json["apiVersionMinor"] != API_VERSION_MINOR) {
            $('#failureAlert').hide();
            $('#warnAlert').show();

            document.getElementById("warnAlertText").innerHTML = "Warning: Server [Minor] API version (" +
                        json["apiVersionMinor"] + ") does not match ours (" + API_VERSION_MINOR + ")";
            API_VERSION_MINOR = json["apiVersionMinor"].toString();
        }

        SERVER_SOFTWARE = json["software"];
        SERVER_SOFTWARE_VERSION = json["softwareVersion"];

        document.getElementById("noticeAlertText").innerHTML = "Successfully contacted server for inital check";
    }).fail(function(xhr, textStatus, errorThrown) {
        $('#noticeAlert').hide();
        $('#warnAlert').show();
        document.getElementById("warnAlertText").innerHTML = "Failed to connect to server for inital check!";
    });
}

// ANGULAR -------------------------------------------------------------------------------------------------------

var nectarApp = angular.module('nectarWebApp', ["ngRoute"], function($httpProvider) {
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    /**
        FROM: https://stackoverflow.com/questions/19254029/angularjs-http-post-does-not-send-data
    * The workhorse; converts an object to x-www-form-urlencoded serialization.
    * @param {Object} obj
    * @return {String}
    */
    var param = function(obj) {
        var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

        for(name in obj) {
            value = obj[name];

            if(value instanceof Array) {
                for(i=0; i<value.length; ++i) {
                    subValue = value[i];
                    fullSubName = name + '[' + i + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            } else if(value instanceof Object) {
                for(subName in value) {
                    subValue = value[subName];
                    fullSubName = name + '[' + subName + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            } else if(value !== undefined && value !== null)
                query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
            }

        return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {
        return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
    }];
});

registerServices(nectarApp); // appServices.js

nectarApp.config(['$routeProvider', function($routeProvider){
    $routeProvider
    .when("/", {
        templateUrl : "login.html",
        requireLogin : false,
    })
    .when("/panel", {
        templateUrl : "panel.html",
        requireLogin : true
    });
}]).run(function($rootScope, $location, $timeout, $routeParams, $anchorScroll, LoginService, SyncService){
    $rootScope.changeView = function(view) {
        $location.path(view); // path not hash
    };

    $rootScope.scrollTo = function(id) {
        var old = $location.hash();
        $location.hash(id);
        $anchorScroll();
        //reset to old to keep any additional routing logic from kicking in
        $location.hash(old);
    };

    $rootScope.$on('$routeChangeStart', function (event, next) {
        if(next.requireLogin && !LoginService.getUserLoggedIn()) {
            console.log("No access to panel: not logged in.");

            alert("You need to be logged in as an administrator to see this page!");
            event.preventDefault();

            $timeout(function () {
                $rootScope.changeView("/");
            }, 500);
        }
    });
});

nectarApp.controller('exitController', function exitController($scope, $window, $rootScope, $http, LoginService) {
    $scope.onExit = function() {
        if(LoginService.getUserLoggedIn())
            LoginService.doLogout(LoginService, $scope, $rootScope);
    };

    $window.onbeforeunload = $scope.onExit;
});

nectarApp.controller('LoginController', function LoginController($scope, $location, $rootScope, $http, LoginService, KeyService, SyncService) {
    $scope.init = function() {
        $('#successAlert').hide();
        $('#warnAlert').hide();
        $('#failureAlert').hide();

        if(LoginService.getUserLoggedIn() === true) {
            // Redirect to panel if already logged in.
            alert("You are already logged in, redirecting to panel...");
            $rootScope.changeView("/panel");
        } else {
            doInitalRequest($http);
        }

        KeyService.downloadServerPublicKey();
    }

    $scope.doLogin = function(login) {
        //alert("Login Status: " + LoginService.getUserLoggedIn());
        LoginService.doLogin(login, LoginService, KeyService, SyncService, $scope, $rootScope);
        //$scope.loginInformation = angular.copy(login);
    };
});

nectarApp.controller('PanelController', function PanelController($scope, $rootScope, $http, $timeout, LoginService, KeyService, SyncService, ServerOperationsService) {
    $scope.init = function() {
        $("#clientPanelFailureAlert").hide();
        $('#userPanelSuccessAlert').hide();
        $('#userPanelFailureAlert').hide();

        KeyService.downloadServerPublicKey();

        SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, $timeout, true, null, null, null, null);
    };

    $scope.logout = function() {
        LoginService.doLogout(LoginService, $scope, $rootScope);
    };

    $scope.openClientRegisterModal = function() {
        $("#modalClientRegister").modal("toggle");
        console.log("Opened client register modal.");
    };

    $scope.openUserCreateModal = function() {
        $("#modalUserCreate").modal("toggle");
        console.log("Opened user create modal.");
    };

    $scope.openRemoveUserModal = function() {
        $("#modalUserRemove").modal("toggle");
        console.log("opened user remove modal.");
    };

    $scope.registerClient = function() {
        ServerOperationsService.registerClient(LoginService, $scope, $rootScope); // Register the client

        $("#modalClientRegister").modal("toggle"); // Close modal
    };

    $scope.createNewUser = function(userData) {
        if(userData === null) return; // Check if they didn't enter anything
        if(userData.username == "") return;
        if(userData.password == "") return;
        if(userData.isAdmin == null) userData.isAdmin = false; // If the user never checks the box it is undefined

        ServerOperationsService.registerUser(LoginService, $scope, $rootScope, userData);

        $("#modalUserCreate").modal("toggle");
    };

    $scope.removeUser = function(userData) {
        if(userData === null) return;
        if(userData.username == "") return;

        ServerOperationsService.removeUser(LoginService, $scope, $rootScope, userData);

        $("#modalUserRemove").modal("toggle");
    };

    $scope.clientsOnline = 0;
    $scope.serverName = SERVER_ADDR;

    $scope.serverSoftware = SERVER_SOFTWARE;
    $scope.serverSoftwareVersion = SERVER_SOFTWARE_VERSION;
});
