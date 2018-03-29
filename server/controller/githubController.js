var constants = require('../constants');
var Joi = require('joi');
var Boom = require('boom');
var config = require('config');
var Jwt = require('jsonwebtoken')
var storage = require('../data/storage')
var helper = require('../utils/helper')
var accessControl = require('./accessControl');
var clientSecret = config.get('github.client_secret');
var clientId = config.get('github.client_id');
var secret_key = config.get('authentication.privateKey')
var GITHUB_ENDPOINT = constants.GITHUB_ENDPOINT
var Sequelize = require('sequelize');
var Promise = require("bluebird");
var req = require("request")
var analytics = require('collab-analytics')(config.database, config.logging_database);
var socket = require('./socket/handlers');

module.exports = {
    getAccessToken: {
        handler: getAccessToken,
        payload: {
            parse:true
        },
        validate: {
            payload: {
                code: Joi.string().required()
            }
        }
    },
    sync: {
        handler: syncHandler,
        payload: {
            parse: true
        },
        validate: {
            payload: {
                token: Joi.string().required(),
                owner: Joi.string().required(),
                name: Joi.string().required()
            }
        }
    },
    getRepoCommits: {
        handler: getRepoCommits,
    },
    getRepoBranches: {
        handler: getRepoBranches,
    },    
    getRepoReleases: {
        handler: getRepoReleases,
    },
    createGithubIssue: createGithubIssue,
    updateGithubIssue: updateGithubIssue,
    createGithubMilestone: createGithubMilestone,
    updateGithubMilestone: updateGithubMilestone,
    deleteGithubMilestone: deleteGithubMilestone,
    addGithubMilestonesToDB: addGithubMilestonesToDB,
    addGithubIssuesToDB: addGithubIssuesToDB,
    syncCommits: syncCommits,
    syncBranches: syncBranches,
    syncReleases: syncReleases,
};

function addCollabMilestonesToGithub(owner, repo, token, projectId) {
    return new Promise(function(RESOLVE, REJECT) {
        storage.getMilestonesWithCondition({github_id: null, project_id: projectId}).done(function(milestones) {
            var promises = []
            milestones.forEach(function(milestone) {
                promises.push(
                    createGithubMilestone(milestone.id, {title: milestone.content}, owner, repo, token)
                )
            }) // milestones.forEach
            Promise.all(promises).then(function(p) {
                RESOLVE(p)
            }).catch(function(err) {
                REJECT(err)
            })
        }) // getMilestonesWithCondition
    })
}

function createGithubMilestone(milestoneId, milestone, owner, repo, token) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + repo + '/milestones',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        },
        form: JSON.stringify(milestone)
    }
    return new Promise(function (resolve, reject) {
        req.post(options, function(err, res, body) {
            if (err) {
                reject(err)
                return
            }
            var parsedBody = JSON.parse(body)
            if (parsedBody.number) {
                storage.updateMilestone({github_id: parsedBody.id, github_number: parsedBody.number}, milestoneId).done(function() {
                    resolve(parsedBody.number)
                })
            } else {
                reject(parsedBody)
            }
        })
    })
}

function createGithubIssue(taskId, issue, owner, repo, token) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + repo + '/issues',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        },
        form: JSON.stringify(issue)
    }

    return new Promise(function (resolve, reject) {
        req.post(options, function(err, res, body) {
            if (err) {
                reject(err)
                return
            }
            var parsedBody = JSON.parse(body)
            if (parsedBody.number) { // if successful, should return issue id and number
                storage.updateTask({github_id: parsedBody.id, github_number: parsedBody.number}, taskId).done(function() {
                    resolve(parsedBody.number)
                })
            } else {
                reject(parsedBody)
            }
        })
    })
}

function deleteGithubMilestone(owner, repo, token, number) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + repo + '/milestones/' + number,
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }

    return new Promise(function (resolve, reject) {
        req.del(options, function(err, res, body) {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

function updateGithubMilestone(owner, repo, token, number, payload) {
    return githubUpdate('milestones', owner, repo, token, number, payload)
}

function updateGithubIssue(owner, repo, token, number, payload) {
    return githubUpdate('issues', owner, repo, token, number, payload)
}

function githubUpdate(type, owner, repo, token, number, payload) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + repo + '/' + type + '/' + number,
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        },
        form: JSON.stringify(payload)
    }

    return new Promise(function (resolve, reject) {
        req.patch(options, function(err, res, body) {
            if (err) {
                reject(err)
                return
            }
            var parsedBody = JSON.parse(body)
            if (parsedBody.number) { // if successful, should return issue id and number
                resolve(parsedBody.number)
            } else {
                reject(parsedBody)
            }
        })
    })
}

function POSTIssueToGithub(options, taskId, completedOn, owner, name, token) {
    return new Promise(function (resolve, reject) {
        req.post(options, function(err, res, body) {
            if (err) {
                return reject(err)
            }
            var parsedBody = JSON.parse(body)
            if (parsedBody.id) { // if successful, should return issue id
                if (completedOn) {
                    updateGithubIssue(owner, name, token, parsedBody.number, {
                        state: 'closed'
                    }).done(function() {
                        storage.updateTask({github_id: parsedBody.id, github_number: parsedBody.number}, taskId).done(function(res) {
                            resolve(res)
                        })
                    })
                } else {
                    storage.updateTask({github_id: parsedBody.id, github_number: parsedBody.number}, taskId).done(function(res) {
                        resolve(res)
                    })
                }
            } else {
                return reject(err)
            }
        })
    })
}

function addCollabTasksToGithub(owner, name, token, projectId) {
    return new Promise(function (RESOLVE, REJECT) {
        storage.getTasksWithCondition({github_id: null, project_id: projectId}).done(function(tasks) {
            var promises = []
            tasks.forEach(function(task) {
                var options = {
                    url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + name + '/issues',
                    headers: {
                        'User-Agent': 'Collab',
                        'Authorization': 'Bearer ' + token
                    }
                }

                var issueToPOST = {
                    title: task.content
                }

                if (task.milestone_id) { // we need the corresponding github milestone NUMBER
                    storage.getMilestone(task.milestone_id).done(function(milestone) {
                        milestone = JSON.parse(JSON.stringify(milestone))
                        issueToPOST.milestone = milestone.github_number
                        options.form = JSON.stringify(issueToPOST)
                        promises.push(POSTIssueToGithub(options, task.id))
                    })

                } else {
                    options.form = JSON.stringify(issueToPOST)
                    promises.push(POSTIssueToGithub(options, task.id))
                }
            }) // tasks.forEach
            Promise.all(promises).then(function(p) {
                RESOLVE(p)
            }).catch(function(err) {
                REJECT(err)
            })
        }) // getTasksWithCondition
    })
}

function addGithubMilestonesToDB(milestones, projectId) {
    var promises = []
    milestones.forEach(function(githubMilestone) {
        var milestone = {
            content: githubMilestone.title,
            deadline: githubMilestone.due_on,
            project_id: projectId,
            github_id: githubMilestone.id,
            github_number: githubMilestone.number
        }
        promises.push(storage.findOrCreateMilestone(milestone))
    })
    return Sequelize.Promise.all(promises)
}

function addGithubIssuesToDB(issues, projectId) {
    var promises = []
    issues.forEach(function(issue) {
        var task = {
            content: issue.title,
            completed_on: issue.closed_at,
            github_id: issue.id,
            github_number: issue.number,
            project_id: projectId
        }
        if (issue.milestone) {
            var milestonePromise = storage.getMilestonesWithCondition({github_id: issue.milestone.id})
            promises.push(milestonePromise)
            milestonePromise.done(function(milestones) {
                task.milestone_id = milestones[0].id
                promises.push(storage.findOrCreateTask(task))
            })

        } else {
            promises.push(storage.findOrCreateTask(task))
        }
    })
    return Sequelize.Promise.all(promises)
}

function addGithubIssuesToCollab(owner, name, token, projectId) {
    var issueOptions = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + name + '/issues?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }
    return new Promise(function (resolve, reject) {
        req.get(issueOptions , function(err, res, body) {
            if (err) {
                return reject(err)
            }
            var githubIssues = JSON.parse(body)
            if (githubIssues.length === 0) {
                return resolve(true)
            } else {
                addGithubIssuesToDB(githubIssues, projectId).done(function(tasks) {
                    return resolve(tasks)
                })
            }
        })
    })
}

function addGithubMilestonesToCollab(owner, name, token, projectId) {
    var milestoneOptions = {
        url: GITHUB_ENDPOINT + '/repos/' + owner + '/' + name + '/milestones?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }
    return new Promise(function (resolve, reject) {
        req.get(milestoneOptions, function(err, res, body) {
            if (err) {
                return reject(err)
            }
            var githubMilestones = JSON.parse(body)
            if (githubMilestones.length > 0) {
                addGithubMilestonesToDB(githubMilestones, projectId).done(function(milestones) {
                    return resolve(milestones)
                })
            } else {
                return resolve(true)
            }
        })
    })
}

function syncHandler(request, reply) {
    /**
     * Syncs Github issues, milestones etc. with Collab's
     * Should be used when a project is initially connected to Github
     * Milestones should always be added first (before issues/tasks)
     */
    var projectId = request.params.project_id
    var owner = request.payload.owner
    var name = request.payload.name
    var token = request.payload.token

    analytics.github.pullCommits(projectId, owner, name, token);
    analytics.github.pullReleases(projectId, owner, name, token);

    Jwt.verify(helper.getTokenFromAuthHeader(request.headers.authorization), secret_key, function (err, decoded) {
        accessControl.isUserPartOfProject(decoded.user_id, projectId).then(function (isPartOf) {
            if (!isPartOf) {
                reply(Boom.forbidden(constants.FORBIDDEN));
                return;
            }

            var promises = []
            var githubToCollab = new Promise(function (resolve, reject) {
                addGithubMilestonesToCollab(owner, name, token, projectId).then(function() {
                    addGithubIssuesToCollab(owner, name, token, projectId).then(function() {
                        resolve()
                    }, function(err) {
                        reject(err)
                    })
                }, function(err) {
                    reject(err)
                })
            })
            var collabToGithub = new Promise(function (resolve, reject) {
                addCollabMilestonesToGithub(owner, name, token, projectId).then(function() {
                    addCollabTasksToGithub(owner, name, token, projectId).then(function() {
                        resolve()
                    }, function(err) {
                        reject(err)
                    })
                }, function(err) {
                    reject(err)
                })
            })
            var githubCommitsToCollab = new Promise(function (resolve, reject) {
                console.log("this better work githubcommitstocollab");
                syncCommits(owner, name, token, projectId).then(function() {
                    console.log("this worked wow githubcommitstocollab");
                    resolve()
                }, function (err) {
                    reject(err)
                })
            })
            var githubBranchesToCollab = new Promise(function (resolve, reject) {
                console.log("this better work githubbranchestocollab");
                syncBranches(owner, name, token, projectId).then(function() {
                    console.log("this worked wow githubbranchestocollab");
                    resolve()
                }, function (err) {
                    reject(err)
                })
            })
            var githubReleasesToCollab = new Promise(function (resolve, reject) {
                console.log("this better work githubreleasestocollab");
                syncReleases(owner, name, token, projectId).then(function() {
                    console.log("this worked wow githubreleasestocollab");
                    resolve()
                }, function (err) {
                    reject(err)
                })
            })
            promises.push(githubToCollab)
            promises.push(collabToGithub)
            promises.push(githubCommitsToCollab)
            promises.push(githubBranchesToCollab)
            promises.push(githubReleasesToCollab)
            Promise.all(promises).then(function() {
                reply({status: 'OK'})
            }).catch(function(err) {
                console.log(err)
                reply(err)
            })
        })
    })
}

function getAccessToken(request, reply) {
    var code = request.payload.code;
    var options = {
        url: 'https://github.com/login/oauth/access_token',
        headers: {
            'Accept': 'application/json'
        }
    }
    req.post(options)
    .form(
        {
            code: code,
            client_secret: clientSecret,
            client_id: clientId
        }
    )
    .on('error', function(err) {
        reply(Boom.internal(err));
    })
    .on('response', function(res) {
        reply(res)
    })
}

function getRepoCommits(request, reply) {
    var projectId = request.params.project_id;
    var repoOwner = request.params.owner;
    var repoName = request.params.name;
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + repoOwner + '/' + repoName + '/contributors?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }
    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            }
            var commitPayload = JSON.parse(body)
            let contributions = 0;
            let contributors = 0;
            var contributorsURL = 'https://github.com' + '/' + repoOwner + '/' + repoName + '/graphs/contributors';
            var contributionsURL = 'https://github.com' + '/' + repoOwner + '/' + repoName + '/commits/master';

            if (commitPayload.length > 0) {
                commitPayload.forEach(function (commit) {
                  contributions += commit.contributions;
                  contributors += 1;
                })
                let commitsObject = {
                  id: projectId,
                  contributions: contributions,
                  contributors: contributors,
                  contributions_url: contributionsURL,
                  contributors_url: contributorsURL,
                }
                    socket.sendMessageToProject(projectId, 'get_commits', commitsObject);
                    //reply(m);
                    return resolve(commitsObject)
            } else {
                return resolve(true)
            }
        })
    })
}

function syncCommits(owner, name, token, projectId) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + owner + '/' + name + '/contributors?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }

    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            }
            var commitPayload = JSON.parse(body)
            console.log(commitPayload);
            let contributions = 0;
            let contributors = 0;
            var contributorsURL = 'https://github.com' + '/' + owner + '/' + name + '/graphs/contributors';
            var contributionsURL = 'https://github.com' + '/' + owner + '/' + name + '/commits/master';
            if (commitPayload.length > 0) {
                commitPayload.forEach(function (commit) {
                  contributions += commit.contributions;
                  contributors += 1;
                })
                let commitsObject = {
                  id: projectId,
                  contributions: contributions,
                  contributors: contributors,
                  contributions_url: contributionsURL,
                  contributors_url: contributorsURL,
                }
                    socket.sendMessageToProject(projectId, 'get_commits', commitsObject);
                    //reply(m);
                    console.log("Syncing commits received at client side and sent to app-side")
                    return resolve(commitsObject)
            } else {
                return resolve(true)
            }
        })
    })

}

function getRepoBranches(request, reply) {
    var projectId = request.params.project_id;
    var repoOwner = request.params.owner;
    var repoName = request.params.name;
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + repoOwner + '/' + repoName + '/branches?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }
    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            }
            var branchesPayload = JSON.parse(body)
            let branchCount = 0;
            var branchURL = 'https://github.com' + '/' + repoOwner + '/' + repoName + '/branches';
            if (branchesPayload.length > 0) {
                branchesPayload.forEach(function (commit) {
                  branchCount += 1;
                })
                let branchObject = {
                  id: projectId,
                  branchCount: branchCount,
                  url: branchURL,
                }
                    socket.sendMessageToProject(projectId, 'get_branches', branchObject);
                    //reply(m);
                    return resolve(branchObject)
            } else {
                return resolve(true)
            }
        })
    })
}

function syncBranches(owner, name, token, projectId) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + owner + '/' + name + '/branches?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }

    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            }
            var branchPayload = JSON.parse(body)
            let branchCount = 0;
            var branchURL = 'https://github.com' + '/' + owner + '/' + name + '/branches';
            if (branchPayload.length > 0) {
                branchPayload.forEach(function (commit) {
                    branchCount += 1;
                  })
                  let branchObject = {
                    id: projectId,
                    branchCount: branchCount,
                    url: branchURL,
                  }
                    socket.sendMessageToProject(projectId, 'get_branches', branchObject);
                    //reply(m);
                    return resolve(branchObject)
            } else {
                return resolve(true)
            }
        })
    })

}

function getRepoReleases(request, reply) {
    var projectId = request.params.project_id;
    var repoOwner = request.params.owner;
    var repoName = request.params.name;
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + repoOwner + '/' + repoName + '/releases?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }
    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            } 
            var releasesPayload = JSON.parse(body)
            let releaseCount = 0;
            var releaseURL = 'https://github.com' + '/' + repoOwner + '/' + repoName + '/releases';
            if (releasesPayload.length > 0) {
                releasesPayload.forEach(function (commit) {
                  releaseCount += 1;
                })
                let releaseObject = {
                  id: projectId,
                  releaseCount: releaseCount,
                  url: releaseURL,
                }
                socket.sendMessageToProject(projectId, 'get_releases', releaseObject);
                //reply(m);
                return resolve(releaseObject)
            } else {
                let releaseObject = {
                    id: projectId,
                    releaseCount: 0,
                    url: releaseURL,
                }
                socket.sendMessageToProject(projectId, 'get_releases', releaseObject);
                //reply(m);
                return resolve(releaseObject)
            }
        })
    })
}

function syncReleases(owner, name, token, projectId) {
    var options = {
        url: GITHUB_ENDPOINT + '/repos' + '/' + owner + '/' + name + '/releases?state=all',
        headers: {
            'User-Agent': 'Collab',
            'Authorization': 'Bearer ' + token
        }
    }

    return new Promise(function (resolve, reject) {
        req.get(options, function (err, res, body) {
            if (err) {
                return reject(err)
            }
            var releasePayload = JSON.parse(body)
            let releaseCount = 0;
            var releaseURL = 'https://github.com' + '/' + owner + '/' + name + '/releases';
            if (releasePayload.length > 0) {
                releasePayload.forEach(function (commit) {
                    releaseCount += 1;
                  })
                  let releaseObject = {
                    id: projectId,
                    releaseCount: releaseCount,
                    url: releaseURL,
                  }
                    socket.sendMessageToProject(projectId, 'get_releases', releaseObject);
                    //reply(m);
                    return resolve(releaseObject)
            } else {
                let releaseObject = {
                    id: projectId,
                    releaseCount: 0,
                    url: releaseURL,
                }
                socket.sendMessageToProject(projectId, 'get_releases', releaseObject);
                //reply(m);
                return resolve(releaseObject)
            }
        })
    })

}

//new
function addGithubCommitsToDB(commits, projectId) {
    console.log("addGithubCommitsToDB");
    var promises = []
    commits.forEach(function (commit) {
        console.log("commit payload @ addGithubCommitsToDB")
        console.log(commit);
        var commit = {
            contributions: commit.contributions,
            contributors: 1,
            project_id: projectId,
        }
        console.log("addGithubCommitsToDB: contributions: " + commit.contributions);
        console.log("addGithubCommitsToDB: contributors: " + commit.contributors);
        console.log("addGithubCommitsToDB: project_id: " + commit.project_id);
        promises.push(storage.findOrCreateCommit(commit))
    })
    return Sequelize.Promise.all(promises)
} 
