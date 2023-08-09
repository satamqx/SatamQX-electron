const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { autoUpdater } = require("electron-updater");

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
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


app.on('ready', function() {
    autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
    // يمكنك إضافة رسالة هنا لإبلاغ المستخدم بأن التحديث متاح
});

autoUpdater.on('update-downloaded', () => {
    // يمكنك إضافة رسالة هنا لإبلاغ المستخدم بأن التحديث قد تم تحميله وجاهز للتثبيت
    autoUpdater.quitAndInstall();
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
    const serviceNames = await ipcMain.handle('getAllServices', null);
    let serviceStatuses = {};

    for (let serviceName of serviceNames) {
        const status = await getServiceStatus(serviceName);
        serviceStatuses[serviceName] = status;
    }

    mainWindow.webContents.send('serviceStatusUpdate', serviceStatuses);
}

// نستدعي الوظيفة كل 10 ثواني
setInterval(updateServiceStatuses, 10000);
ipcMain.handle('getAllServices', (event) => {
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
                const serviceLines = output.split('\n').slice(3, -2); // قد تحتاج إلى تعديل هذا الرقم حسب النتائج التي تحصل عليها
                const services = serviceLines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        name: parts.slice(0, -1).join(' '),
                        status: parts[parts.length - 1] === 'Running' ? true : false
                    };
                });
                resolve(services);
            }
        });
    });
  });
  
  
  


// في وظيفة startService:
ipcMain.handle('startService', (event, serviceName) => {
    return new Promise((resolve, reject) => {
        const command = spawn('net', ['start', serviceName]);
        command.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Failed to start service: ${serviceName}`));
            } else {
                // هنا نقوم بإرسال الرسالة
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
  
