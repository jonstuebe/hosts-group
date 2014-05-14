/**
 * @author xiaojue
 * @email designsor@gmail.com
 * @fileoverview hosts-group
 */
var fs = require('fs');
var os = require('os');
var util = require('util');
var groupReg = /^## @(.*?)$/;
var blankReg = /\s+/;
var defaultName = 'defaultGroup';

function hosts() {
	this.HOSTS = os.platform() == 'win32' ? 'C:/Windows/System32/drivers/etc/hosts': '/etc/hosts';
	this.EOL = os.EOL;
	this.format();
}

hosts.prototype = {
	constructor: hosts,
	//返回所有的group object
	get: function() {
		var hostsstr = fs.readFileSync(this.HOSTS, 'utf-8');
		//一个domain 对应一个ip
		//先分组，再去重
		//之后去重
		var lines = hostsstr.split(this.EOL),
		hostsobject = {},
		currentName;
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i],
			nextline = lines[i + 1],
			isGroupLine = line.match(groupReg);
			if (isGroupLine) {
				currentName = isGroupLine[1];
				hostsobject[currentName] = [];
			} else {
				if (!this._isHostLine(line)) continue;
				if (!currentName) currentName = defaultName;
				hostsobject = this._addHosts(currentName, hostsobject, this._formatLine(line));
			}
		}
		return hostsobject;
	},
	//设置一个domain
	set: function(domain, ip, groupName, olddomain, oldip) {
		this._batchHost(function(hostsobject) {
			groupName = groupName || defaultName;
			if (!hostsobject[groupName]) hostsobject[groupName] = [];
			var group = hostsobject[groupName];
			var fixed = false;
			if (olddomain && oldip) {
				for (var i = 0; i < group.length; i++) {
					if (group[i].domain == olddomain && group[i].ip == oldip) {
						group[i].ip = ip;
						group[i].domain = domain;
						fixed = true;
						break;
					}
				}
			}
			if (!fixed) {
				var flg = false;
				for (var key = 0; key < group.length; key++) {
					if (group[key].domain == domain && group[key].ip == ip) {
						flg = true;
						break;
					}
				}
				if (!flg) {
					group.push({
						ip: ip,
						domain: domain,
						disabled: false
					});
				}
			}
			return hostsobject;
		});
	},
	addGroup: function(groupName) {
		this._batchHost(function(hostsobject) {
			if (!hostsobject[groupName]) hostsobject[groupName] = [];
			return hostsobject;
		});
	},
	removeGroup: function(groupName) {
		this._batchHost(function(hostsobject) {
			if (hostsobject[groupName]) delete hostsobject[groupName];
			return hostsobject;
		});
	},
	setGroup: function(oldName, newName) {
		this._batchHost(function(hostsobject) {
			if (hostsobject[oldName]) {
				hostsobject[newName] = hostsobject[oldName];
				delete hostsobject[oldName];
			}
			return hostsobject;
		});
	},
	move: function(domain, ip, groupName, target_groupName) {
		this._batchHost(function(hostsobject) {
			var group = hostsobject[groupName];
			if (group) {
				var move;
				for (var i = 0; i < group.length; i++) {
					var host = group[i];
					if (host.domain == domain && host.ip == ip) {
						move = group.splice(i, 1);
						break;
					}
				}
				if (move && hostsobject[target_groupName]) hostsobject[target_groupName].push(move);
			}
			return hostsobject;
		});
	},
	remove: function(domain, ip, groupName) {
		this._batchHost(function(hostsobject) {
			var group = hostsobject[groupName];
			if (group) {
				for (var i = 0; i < group.length; i++) {
					var host = group[i];
					if (host.domain == domain && host.ip == ip) {
						group.splice(i, 1);
						break;
					}
				}
			}
			return hostsobject;
		});
	},
	setDomainDisabled: function(domain, ip, groupName, disabled) {
		this._batchHost(function(hostsobject) {
			var group = hostsobject[groupName];
			if (group) {
				for (var i = 0; i < group.length; i++) {
					var host = group[i];
					if (host.domain == domain && host.ip == ip) {
						host.disabled = disabled;
					}
				}
			}
			return hostsobject;
		});
	},
	//注释一个domain
	disable: function(domain, ip, groupName) {
		this.setDomainDisabled(domain, ip, groupName, true);
	},
	//去注释一个domain
	active: function(domain, ip, groupName) {
		this.setDomainDisabled(domain, ip, groupName, false);
	},
	setGroupDisabled: function(groupName, disabled) {
		this._batchHost(function(hostsobject) {
			var group = hostsobject[groupName];
			if (group) {
				for (var i = 0; i < group.length; i++) {
					group[i].disabled = disabled;
				}
			}
			return hostsobject;
		});
	},
	//注释一个组
	disableGroup: function(groupName) {
		this.setGroupDisabled(groupName, true);
	},
	//激活一个组
	activeGroup: function(groupName) {
		this.setGroupDisabled(groupName, false);
	},
	//初始化hosts文件,生成默认分组
	format: function() {
		this._batchHost();
	},
	_batchHost: function(fn) {
		var hostsobject = this.get();
		hostsobject = fn ? fn(hostsobject) : hostsobject;
		var linesStr = this._hostTostr(hostsobject);
		fs.writeFileSync(this.HOSTS, linesStr);
	},
	_hostTostr: function(hostobj) {
		var lines = [];
		for (var i in hostobj) {
			lines.push('## @' + i);
			hostobj[i].forEach(function(host) {
				var line = '';
				if (host.disabled) line += '#';
				line += host.ip + ' ' + host.domain;
				lines.push(line);
			});
		}
		return lines.join(this.EOL);
	},
	_addHosts: function(name, group, line) {
		if (!group[name]) group[name] = [];
		for (var i in line) {
			line[i]['domain'] = i;
			group[name].push(line[i]);
		}
		return group;
	},
	_isHostLine: function(line) {
		if (line.trim() === '') return false;
		line = line.split(blankReg);
		if (line.length < 2 || ! line[0].match(/^\d|#[\d]/g)) return false;
		return true;
	},
	_formatLine: function(line) {
		line = line.split(blankReg);
		var hostline = {},
		ip = line.shift(),
		domains = line,
		disabled = (/^#/).test(ip);
		if (disabled) ip = ip.slice(1);
		domains.forEach(function(domain) {
			hostline[domain] = {
				ip: ip,
				disabled: disabled
			};
		});
		return hostline;
	}
};

module.exports = new hosts();
