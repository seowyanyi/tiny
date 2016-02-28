import Avatar from 'material-ui/lib/avatar';
import React, { Component } from 'react'
import {Tooltip, OverlayTrigger} from 'react-bootstrap'

function hasTrailingSlash(urlString) {
	return urlString[urlString.length-1] === '/';
}

function trimUrlString(urlString) {
	if (hasTrailingSlash(urlString)) {
		return urlString.substring(0, urlString.length-1);
	} 
	return urlString
}

export function matchesUrl(a, b) {
	// Checks whether url a matches url b
	return trimUrlString(a) === trimUrlString(b);
}

export function getCurrentProject() {
	var re = /\/project\/([^\/]+)/i
	return extractRegexGroup(re)
}

export function getCurrentTab() {
	//Gets the current tab user is on (Milestone, Files, Github, Settings etc.) based on url
	var re = /\/project\/[^\/]+\/([a-z]+)/i
	return extractRegexGroup(re)
}

export function getGithubAuthCode() {
	var re = /\?code=([^\/&]+)/i
	return extractRegexGroup(re)
}

function extractRegexGroup(re) {
	var regexResultArray = re.exec(window.location.toString())
	if (regexResultArray) return regexResultArray[1]
	return ''
}

export function getProjectRoot() {
		return '/app/project/' + getCurrentProject()
}

export function isItemPresent(arr, id) {
	return arr.indexOf(id) >= 0;
}

export function isObjectPresent(arr, id) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].id === id) return true
	}
	return false
}

export function getUserAvatar(imgSrc, displayName, enableTooltip) {
	let image = null
	if (imgSrc && imgSrc !== 'undefined') {
		image = <Avatar size={36} src={imgSrc} />
	} else {
		image = <Avatar size={36}>{displayName[0]}</Avatar>
	}

	if (enableTooltip) {
		const tooltip = (
				<Tooltip id={displayName}>{displayName}</Tooltip>
		);
		image = (
				<OverlayTrigger placement="bottom" overlay={tooltip}>
					{image}
				</OverlayTrigger>
				)
	}
	return image
}