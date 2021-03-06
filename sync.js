function constructUsersChartData(json, $scope) {
    var data = [0, 0, 0, 0];

    var usersOnline = 0;
    var adminsOnline = 0;

    for (var user in json) {
        var signedIn = json[user]["signedIn"];
        var admin = json[user]["admin"];

        if(signedIn) usersOnline++;
        if(admin && signedIn) adminsOnline++;

        if(signedIn && !admin) {
            data[0]++; //User online and not admin
        } else if(signedIn && admin) {
            data[2]++; //User online and admin
        } else if(!signedIn && !admin) {
            data[1]++; //User offline and not admin
        } else if(!signedIn && admin) {
            data[3]++; //User offline and admin
        }
    }

    $scope.usersOnline = usersOnline;
    $scope.adminsOnline = adminsOnline;

    return data;
}

function constructClientsChartData(json, $scope) {
    var data = [0, 0, 0, 0, 0];
    var updatesNeeded = [0, 0];
    var operations = [0, 0, 0, 0];

    var clientsOnline = 0;

    for (var client in json) {
        var state = json[client]["state"];

        switch(state) {
            case 0:
                clientsOnline++;
            case 1:
            case 2:
            case 3:
            case 4:
                data[state]++;

                if(json[client]["updates"] !== null && json[client]["updates"] > 0) {
                    updatesNeeded[1]++;
                } else updatesNeeded[0]++;

                if(json[client]["operationStatus"] !== null) {
                    switch(json[client]["operationStatus"]) {
                        case 0:
                            operations[0]++;
                            break;
                        case 1:
                            operations[3]++;
                            break;
                        case 2:
                            operations[1]++;
                            break;
                        case 3:
                            operations[2]++;
                            break;
                        default:
                            break;
                    }
                }
                break;
        }
    }

    $scope.clientsOnline = clientsOnline;

    return {stateData: data, updatesData: updatesNeeded, operationsData: operations};
}


function syncClients(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb) {
    $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/query/queryClients?token=" + LoginService.getSessionToken())
    .done(function(data, status, xhr) {
        console.log("Got response for queryClients SUCCESS: " + xhr.status + " " + xhr.statusText);

        var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);
        SyncService.setLastClientSyncJSONData(json);

        var data = constructClientsChartData(json, $scope);

        if(inital) {
            var clientsCtx = document.getElementById("clientsChart");
            var updatesCtx = document.getElementById("updatesChart");
            var operationsCtx = document.getElementById("operationsChart");

            clientsChart = new Chart(clientsCtx, {
                type: 'pie',
                data: {
                    labels: [
                        "Online",
                        "Shutdown",
                        "Sleeping",
                        "Restarting",
                        "Unknown"
                    ],
                    datasets: [
                        {
                            data: data.stateData,
                            backgroundColor: [
                                "#20f718",
                                "#35f4ff",
                                "#e1ff77",
                                "#ffd334",
                                "#FF6384"
                            ],
                            hoverBackgroundColor: [
                                "#20f718",
                                "#35f4ff",
                                "#e1ff77",
                                "#ffd334",
                                "#FF6384"
                            ]
                        }
                    ]
                },
                options: {
                    animation:{
                        animateScale: true
                    }
                }
            });

            updatesChart = new Chart(updatesCtx, {
                type: 'pie',
                data: {
                    labels: [
                        "Up to date",
                        "Updates Needed"
                    ],
                    datasets: [
                        {
                            data: data.updatesData,
                            backgroundColor: [
                                "#20f718",
                                "#ffd334",
                            ],
                            hoverBackgroundColor: [
                                "#20f718",
                                "#ffd334",
                            ]
                        }
                    ]
                },
                options: {
                    animation:{
                        animateScale: true
                    }
                }
            });

            operationsChart = new Chart(operationsCtx, {
                type: 'pie',
                data: {
                    labels: [
                        "Idle",
                        "Idle (Succeeded)",
                        "Idle (Failed)",
                        "Processing"
                    ],
                    datasets: [
                        {
                            data: data.operationsData,
                            backgroundColor: [
                                "#20f718",
                                "#9cff99",
                                "#ff8c00",
                                "#b784ff",
                            ],
                            hoverBackgroundColor: [
                                "#20f718",
                                "#9cff99",
                                "#ff8c00",
                                "#b784ff",
                            ]
                        }
                    ]
                },
                options: {
                    animation:{
                        animateScale: true
                    }
                }
            });
        } else {
            clientsChart.data.datasets[0].data = data.stateData;
            clientsChart.update();

            updatesChart.data.datasets[0].data = data.updatesData;
            updatesChart.update();

            operationsChart.data.datasets[0].data = data.operationsData;
            operationsChart.update();
        }

        cb();

        $timeout(function() {
            SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, $timeout, false, clientsChart, updatesChart, operationsChart, usersChart);
        }, 5000); // Sync every 5 seconds
    }).fail(function(xhr, textStatus, errorThrown) {
        // TODO: seperate messages based on status code
        console.error("Got response for queryClients FAILURE: " + xhr.status + " " + xhr.statusText);

        if(xhr.status !== 403) alert("Failed to query server! (" + xhr.status + " " + xhr.statusText + ")");

        cb();

        $timeout(function() {
            SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, $timeout, false, clientsChart, updatesChart, operationsChart, usersChart);
        }, 5000); // Sync every 5 seconds
    });
}

function syncUsers(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb) {
    $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/query/queryUsers?token=" + LoginService.getSessionToken())
    .done(function(data, status, xhr) {
        console.log("Got response for queryUsers SUCCESS: " + xhr.status + " " + xhr.statusText);

        var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);
        var data = constructUsersChartData(json, $scope);

        if(inital) {
            var usersCtx = document.getElementById("usersChart");

            usersChart = new Chart(usersCtx, {
                type: 'pie',
                data: {
                    labels: [
                        "Logged In",
                        "Logged Out",
                        "Logged In (Admin)",
                        "Logged Out (Admin)"
                    ],
                    datasets: [
                        {
                            data: data,
                            backgroundColor: [
                                "#20f718",
                                "#4fffbe",
                                "#e1ff77",
                                "#ffd334"
                            ],
                            hoverBackgroundColor: [
                                "#20f718",
                                "#4fffbe",
                                "#e1ff77",
                                "#ffd334"
                            ]
                        }
                    ]
                },
                options: {
                    animation:{
                        animateScale: true
                    }
                }
            });
        } else {
            usersChart.data.datasets[0].data = data;
            usersChart.update();
        }

        syncEventLog(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
    }).fail(function(xhr, textStatus, errorThrown) {
        // TODO: seperate messages based on status code
        console.error("Got response for queryClients FAILURE: " + xhr.status + " " + xhr.statusText);

        if(xhr.status !== 403) alert("Failed to query server! (" + xhr.status + " " + xhr.statusText + ")");

        syncEventLog(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
    });
}

function syncEventLog(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb) {
    // If inital is true (first time querying the server) then get the whole event log.
    if(inital) {
        $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/query/queryEventLog?token=" + LoginService.getSessionToken() + "&entryCount=150")
        .done(function(data, status, xhr) {
            console.log("Got response for queryEventLog SUCCESS: " + xhr.status + " " + xhr.statusText);

            var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);
            SyncService.setLastSyncEntryId(json["lastEntryId"]);

            document.getElementById("eventLog").innerHTML = json["entries"];

            syncClients(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
        }).fail(function(xhr, textStatus, errorThrown) {
            // TODO: seperate messages based on status code
            console.error("Got response for queryEventLog FAILURE: " + xhr.status + " " + xhr.statusText);

            if(xhr.status !== 403) alert("Failed to query server! (" + xhr.status + " " + xhr.statusText + ")");

            syncClients(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
        });
    } else {
        $.get(URL_PREFIX + "nectar/api/v/" + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/query/queryEventLogSince?token=" + LoginService.getSessionToken() + "&entryId=" + SyncService.getLastSyncEntryId())
        .done(function(data, status, xhr) {
            console.log("Got response for queryEventLogSince SUCCESS: " + xhr.status + " " + xhr.statusText);

            var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);
            SyncService.setLastSyncEntryId(json["lastEntryId"]);

            document.getElementById("eventLog").innerHTML += json["entries"];

            syncClients(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
        }).fail(function(xhr, textStatus, errorThrown) {
            // TODO: seperate messages based on status code
            console.error("Got response for queryEventLogSince FAILURE: " + xhr.status + " " + xhr.statusText);

            if(xhr.status !== 403) alert("Failed to query server! (" + xhr.status + " " + xhr.statusText + ")");

            syncClients(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, cb);
        });
    }
}
