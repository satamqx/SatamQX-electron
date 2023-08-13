const { app, BrowserWindow, dialog, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const { autoUpdater } = require("electron-updater");
const { ipcMain } = require('electron');
const { Client } = require('discord-rpc');
const clientId = '1139938365127532565'; // استبدل هذا بـ Client ID الخاص بتطبيقك في Discord
const rpc = new Client({ transport: 'ipc' });

rpc.login({ clientId }).catch(console.error);

rpc.on('ready', () => {
    console.log('Discord RPC is ready!');

    // هنا يمكنك تحديث الحالة إذا أردت:
    rpc.setActivity({
        details: 'ادارة خدمات النظام',
        state: 'قيد التطوير',
        startTimestamp: new Date(),
        largeImageKey: 'icon',
        largeImageText:"دادي سطام", // استبدل هذا بالمفتاح الخاص بالصورة الكبيرة التي أضفتها في إعدادات Rich Presence
        smallImageKey: "not_work", // استبدل هذا بالمفتاح الخاص بالصورة الصغيرة التي أضفتها في إعدادات Rich Presence
        smallImageText:"تحت التطوير",
        instance: false,
    });
});

let win;
let tray = null;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: __dirname + '/icon.ico',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');

    win.on('close', (e) => {
        e.preventDefault(); // منع الإغلاق الافتراضي
        dialog.showMessageBox({
            type: 'question',
            buttons: ['نعم', 'لا', 'تشغيل في الخلفية'],
            title: 'تأكيد',
            message: 'في حال إغلاق البرنامج سيتم استعادة الخدمات. هل ترغب في الاستمرار؟'
        }).then(result => {
            if (result.response === 0) {
                win.webContents.send('prepare-to-close');
            } else if (result.response === 2) {
                win.hide();
                if (tray === null) {
                    createTray();
                }
            }
        });
    });
}

function createTray() {
    tray = new Tray(__dirname + '/icon.ico'); // حدد مسار الأيقونة هنا

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'عرض',
            click: () => {
                win.show();
            }
        },
        {
            label: 'إغلاق',
            click: () => {
                win.destroy(); // أغلق النافذة بشكل نهائي
                app.quit(); // أغلق التطبيق
            }
        }
    ]);

    tray.setToolTip('ادارة الخدمات');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        win.show();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('ready-to-close-app', () => {
    console.log("Received ready-to-close-app message. Closing app now.");  // رسالة للتأكيد
    win.removeAllListeners('close');
    app.exit();
});

autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
});



function getServiceStatus(serviceName) {
    return new Promise((resolve, reject) => {
        const command = spawn('sc', ['query', serviceName]);

        let output = '';
        command.stdout.on('data', (data) => {
            output += data.toString();
        });

        command.stderr.on('data', (data) => {
            reject(new Error(`Error querying service ${serviceName}: ${data}`));
        });

        command.on('close', (code) => {
            if (output.includes("RUNNING")) {
                resolve(true); // الخدمة تعمل
            } else {
                resolve(false); // الخدمة لا تعمل أو غير موجودة
            }
        });
    });
}

ipcMain.handle('getServiceStatus', (event, serviceName) => {
    return getServiceStatus(serviceName);
});
// وظيفة لتحديث حالة الخدمات وإرسالها للواجهة الرسومية
async function updateServiceStatuses() {
    const services = await getAllServices();
    let serviceStatuses = {};

    for (let service of services) {
        const status = await getServiceStatus(service.name);
        serviceStatuses[service.name] = status;
    }

    win.webContents.send('serviceStatusUpdate', serviceStatuses);
}


// نستدعي الوظيفة كل 10 ثواني
setInterval(updateServiceStatuses, 10000);
async function getAllServices() {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const command = spawn('powershell', ['Get-Service | Select-Object Name,Status']);

        let output = '';
        command.stdout.on('data', (data) => {
            output += data.toString();
        });

        command.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Failed to get services.'));
            } else {
                const serviceLines = output.split('\n').slice(3, -2);
                const services = serviceLines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        name: parts.slice(0, -1).join(' '),
                        status: parts[parts.length - 1] === 'Running' ? true : false
                    };
                }).filter(service => service.name && service.status !== undefined);

                resolve(services);
            }
        });
    });
}

ipcMain.handle('getAllServices', async (event) => {
    return await getAllServices();
});

  
// في وظيفة startService:
ipcMain.handle('startService', (event, serviceName) => {
    return new Promise((resolve, reject) => {
        const command = spawn('net', ['start', serviceName]);
        let errorOutput = ''; // متغير لتخزين رسائل الخطأ

        command.stderr.on('data', (data) => {
            errorOutput += data.toString(); // جمع رسائل الخطأ
        });

        command.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Failed to start service: ${serviceName}. Error: ${errorOutput}`)); // طباعة رسائل الخطأ
            } else {
                event.sender.send('serviceStatusChanged', {serviceName, status: true});
                resolve(`Service ${serviceName} started successfully.`);
            }
        });
    });
});


ipcMain.handle('stopService', (event, serviceName) => {
    return new Promise((resolve, reject) => {
        const command = spawn('net', ['stop', serviceName]);
        command.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Failed to stop service: ${serviceName}`));
            } else {
                event.sender.send('serviceStatusChanged', {serviceName, status: false});
                resolve(`Service ${serviceName} stopped successfully.`);
            }
        });
    });
});

async function startService(serviceName) {
    return new Promise((resolve, reject) => {
      const command = spawn('net', ['start', serviceName]);
      command.on('close', (code) => {
          if (code !== 0) {
              reject(new Error(`Failed to start service: ${serviceName}`));
          } else {
              resolve(`Service ${serviceName} started successfully.`);
          }
      });
    });
  }
  
  async function stopService(serviceName) {
    return new Promise((resolve, reject) => {
      const command = spawn('net', ['stop', serviceName]);
      command.on('close', (code) => {
          if (code !== 0) {
              reject(new Error(`Failed to stop service: ${serviceName}`));
          } else {
              resolve(`Service ${serviceName} stopped successfully.`);
          }
      });
    });
  }
  
  ipcMain.handle('restartService', async (event, serviceName) => {
    try {
      await stopService(serviceName);
      await startService(serviceName);
      return `Service ${serviceName} restarted successfully.`;
    } catch (err) {
      throw new Error(`Failed to restart service: ${serviceName}. ${err}`);
    }
  });
  
  function updateWingetSource() {
    return new Promise((resolve, reject) => {
        const command = spawn('winget', ['source', 'update']);

        let output = '';
        command.stdout.on('data', (data) => {
            output += data.toString();
        });

        command.stderr.on('data', (data) => {
            reject(new Error(`Error updating winget source: ${data}`));
        });

        command.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Failed to update winget source.'));
            } else {
                resolve('Winget source updated successfully.');
            }
        });
    });
}

const checkUpgradableApps = async () => {
  await updateWingetSource();

  return new Promise((resolve, reject) => {
      const command = spawn('winget', ['list', '--upgrade-available']);

      let output = '';
      command.stdout.on('data', (data) => {
          output += data.toString();
      });

      command.stderr.on('data', (data) => {
          reject(new Error(`Error checking upgradable apps: ${data}`));
      });

      command.on('close', (code) => {
          if (code !== 0) {
              reject(new Error('Failed to check upgradable apps.'));
          } else {
              console.log("Raw output:", output);  // طباعة الناتج الخام

              const regex = /(.+?)\s+(\S+)\s+(\S+)\s+(\S+)\s+winget/g;
              let match;
              const apps = [];

              while ((match = regex.exec(output)) !== null) {
                  apps.push({
                      name: match[1].trim(),
                      id: match[2],
                      version: match[3],
                      availableVersion: match[4],
                      source: 'winget'
                  });
              }

              resolve(apps);
          }
      });
  });
};
function upgradeAllApps() {
    return new Promise(async (resolve, reject) => {
        const appsToUpgrade = await checkUpgradableApps();
        let failedApps = [];

        // 1. Store all upgrade promises in an array
        let upgradePromises = appsToUpgrade.map(app => {
            return new Promise((upgradeResolve, upgradeReject) => {
                try {
                    const upgradeCommand = spawn('winget', ['upgrade', app.id]);
                    let errorOutput = '';

                    upgradeCommand.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });

                    upgradeCommand.on('close', (code) => {
                        if (code !== 0) {
                            console.error(`Failed to upgrade app: ${app.name}. Error: ${errorOutput}`);
                            failedApps.push(app.name);
                            upgradeReject();  // Reject this upgrade promise
                        } else {
                            upgradeResolve(); // Resolve this upgrade promise
                        }
                    });
                } catch (err) {
                    console.error(`Exception while upgrading app: ${app.name}. Error: ${err.message}`);
                    failedApps.push(app.name);
                    upgradeReject(); // Reject this upgrade promise due to exception
                }
            });
        });

        // 2. Wait for all upgrade promises to settle
        let results = await Promise.allSettled(upgradePromises);

        // 3. Decide the final result based on settled promises
        if (failedApps.length) {
            resolve(`Failed to upgrade the following apps: ${failedApps.join(', ')}`);
        } else {
            resolve('All apps upgraded successfully.');
        }
    });
}




ipcMain.handle('checkUpgradableApps', async (event) => {
    return await checkUpgradableApps();
});

ipcMain.handle('upgradeAllApps', async (event) => {
    return await upgradeAllApps();
});

