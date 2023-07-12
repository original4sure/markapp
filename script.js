const fileInput = document.querySelector("input"),
  // downloadBtn = document.querySelector("button");
  // updateBtn = document.getElementById("update-button")
  uidManagerStatus = document.getElementById("uidManager-status")
uidManagerDownloader = document.getElementById("uidManager-spinner")
mongoStatus = document.getElementById("mongodb-status")
mongoSpinner = document.getElementById("mongodb-spinner")
serializerSpinner = document.getElementById("serializer-spinner")
serializerStatus = document.getElementById("serializer-status")
labelPrinterSpinner = document.getElementById("labelPrinter-spinner")
labelPrinterStatus = document.getElementById("labelPrinter-status")
versionElement = document.getElementById("version")
let serviceStatuses = []

function fetchFile(url) {
  fetch(url).then(res => res.blob()).then(file => {
    let tempUrl = URL.createObjectURL(file);
    const aTag = document.createElement("a");
    aTag.href = tempUrl;
    aTag.download = url.replace(/^.*[\\\/]/, '');
    document.body.appendChild(aTag);
    aTag.click();
    installBtn.innerText = "Download File";
    URL.revokeObjectURL(tempUrl);
    aTag.remove();
  }).catch(() => {
    alert("Failed to download file!");
    installBtn.innerText = "Download File";
  });
}

ipcRenderer.on('app-version', (version) => {
  console.log("app version")
  console.log(version)
  versionElement.innerHTML = version
});

ipcRenderer.on('update:status', (status) => {
  console.log(JSON.stringify(status))
  let updateStatus = document.getElementById("update-status")
  if(Object.keys(status).includes(`updating`)) {
    if(status.updating) {
      // updateServiceSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
      updateStatus.innerHTML = 'Updating Mark Services'
    }else {
      // updateServiceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      let updatedSuccesfully = status['updated-successfully']
      if(updatedSuccesfully) {
        // updateServiceSpinner.classList.add("fa", "fa-check-square-o")
        updateStatus.innerHTML = `Successfully Updated Mark`
      } else {
        updateStatus.innerHTML = `Mark update failed`
      }
    }
  }

  let updateServiceSpinner = document.getElementById("update-service-spinner")
  let updateServiceStatus = document.getElementById("update-service-status")
  if (status.stoppingServices) {
    updateServiceSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
    updateServiceStatus.innerHTML = `Stopping Mark Services`
  }
  if (Object.keys(status).includes(`stoppingServices`)) {
    if (!status.stoppingServices) {
      if (Object.keys(status).includes('stopped-successfully')) {
        let isSuccessfullyStopped = status['stopped-successfully']
        if (isSuccessfullyStopped) {
          updateServiceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
          updateServiceSpinner.classList.add("fa", "fa-check-square-o")
          updateServiceStatus.innerHTML = `Stopped Mark Services`
        } else {
          updateServiceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
          updateServiceSpinner.classList.add("fa", "fa-close")
          updateServiceStatus.innerHTML = `Stopping Mark Services Failed`
        }
      }
    }
  }

  if (Object.keys(status).includes(`downloading`)) {
    let downloadSpinner = document.getElementById("update-download-spinner")
    let downloadStatus = document.getElementById("update-download-status")
    if (status.downloading) {
      downloadSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
      downloadStatus.innerHTML = `Downloading the updated services`
    }
    else if (!status.downloading) {
      downloadSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      let donwloadedSuccessfully = status['downloaded-sucessfully']
      if (donwloadedSuccessfully) {
        downloadSpinner.classList.add("fa", "fa-check-square-o")
        downloadStatus.innerHTML = `Service downloaded up to date`
      } else {
        downloadSpinner.classList.add("fa", "fa-close")
        downloadStatus.innerHTML = `Services downloaded failed`
      }
    }
  }


    if (Object.keys(status).includes('installing')) {
      console.log(`coming to inclusing installing status`)
      let updateInstallationSpinner = document.getElementById("update-installation-spinner")
      let updateInstallationStatus = document.getElementById("update-installation-status")
      console.log(status.installing)
      if (status.installing) {
        updateInstallationSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
        updateInstallationStatus.innerHTML = `Installing updated services`
      } else if (!status.installing) {
        updateInstallationSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
        let installationSuccessful = status['installation-successful']
        console.log(`installationSuccessful ${installationSuccessful}`)
        if (installationSuccessful) {
          updateInstallationSpinner.classList.add("fa", "fa-check-square-o")
          updateInstallationStatus.innerHTML = `Installation successful`
        } else {
          updateInstallationSpinner.classList.add("fa", "fa-close")
          updateInstallationStatus.innerHTML = `Installation Failed`
        }
      }
    }

    if (Object.keys(status).includes('restarting-services')) {
      console.log(`coming to restarting services`)
      let restartingServicesSpinner = document.getElementById("update-restarting-services-spinner")
      let restartingServicesStatus = document.getElementById("update-restarting-services-status")
      console.log(status['restarting-services'])
      if (status['restarting-services'] === true) {
        console.log("coming up to set thee value")
        restartingServicesSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
        restartingServicesStatus.innerHTML = `Starting updated services`
      } else if (status['restarting-services'] === false) {
        console.log("coming up to set thee value 2")
        restartingServicesSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
        let installationSuccessful = status['update-installation-successful']
        if (installationSuccessful) {
          console.log("coming up to set thee value 3")
          restartingServicesSpinner.classList.add("fa", "fa-check-square-o")
          restartingServicesStatus.innerHTML = `Services started successfully`
        } else {
          console.log("coming up to set thee value 4" )
          restartingServicesSpinner.classList.add("fa", "fa-close")
          restartingServicesStatus.innerHTML = `Services startup Failed`
        }
      }
    }
})


ipcRenderer.on('service:status', (status) => {
  // {
  //   name: service,
  //   isRunning: false
  // }
  console.log('asdsdasdas')
  serviceStatuses.push(status)
  let serviceStatus = document.getElementById("service-status")
  let serviceSpinner = document.getElementById("service-spinner")
  if (serviceStatuses.length > 0 && serviceStatuses.length < 7) {
    serviceStatus.innerHTML = 'Runing up the services'
    serviceSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
  } else if (serviceStatuses.length === 7) {
    let serviceNotRunning = serviceStatuses.filter(service => !service.isRunning)
    console.log(serviceNotRunning)
    serviceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
    // let classesToAdd = []
    let message
    if (serviceNotRunning.length > 1) {
      message = `Services ${serviceNotRunning.map(service => service.name).join(", ")} are not running`
      serviceSpinner.classList.add("fa", "fa-close")
    } else if (serviceNotRunning.length === 1) {
      message = `Service ${serviceNotRunning[0].name} is not running`
      serviceSpinner.classList.add("fa", "fa-close")
    } else {
      serviceSpinner.classList.add("fa", "fa-check-square-o")
      message = `Mark is up and running at localhost:6060`
    }
    serviceStatus.innerHTML = message

  }
});

// {
//  {
//   servicesDownloaded : true/false,
//   listedServicesRunning: true/false
//  }
// }
ipcRenderer.on('installation:status', (installationStatus) => {
  // console.log(installationStatus)
  // let serviceStatus = document.getElementById("service-already-installed-status")
  // serviceStatus.innerHTML = JSON.stringify(installationStatus)
  // let installationSpinner = document.getElementById("install-spinner")
  // installationSpinner.classList.add("fa", "fa-check-square-o")
  //   let installationStatus = document.getElementById("install-status")
  //   installationStatus.innerHTML = "Services are already installed click here to reinstall"
  if (installationStatus.servicesDownloaded) {
    let installationSpinner = document.getElementById("install-spinner")
    installationSpinner.classList.add("fa", "fa-check-square-o")
    let installationStatusTag = document.getElementById("install-status")
    installationStatusTag.innerHTML = "Services are already installed"
    if (installationStatus.listedServicesRunning) {
      let serviceSpinner = document.getElementById("service-already-installed-spinner")
      serviceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      serviceSpinner.classList.add("fa", "fa-check-square-o")
      let serviceStatus = document.getElementById("service-already-installed-status")
      serviceStatus.innerHTML = 'Mark is up and running'
    } else if (installationStatus.startingServices) {
      let serviceSpinner = document.getElementById("service-already-installed-spinner")
      serviceSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
      let serviceStatus = document.getElementById("service-already-installed-status")
      // servicesNotRunning
      serviceStatus.innerHTML = `Starting up the services`
    }
    else if (installationStatus.servicesNotRunning.length > 0) {
      let serviceSpinner = document.getElementById("service-already-installed-spinner")
      serviceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      serviceSpinner.classList.add("fa", "fa-close")
      let serviceStatus = document.getElementById("service-already-installed-status")
      // servicesNotRunning
      serviceStatus.innerHTML = `Service ${installationStatus.servicesNotRunning.join(", ")} not running!!`
    }
  }
})
ipcRenderer.on('dependency-running:status', (dependencyStatuses) => {
  // mongoStatus.innerHTML = `Installing ${dependencyStatuses[0].name} and it's component`
  for (let dependency of dependencyStatuses) {

    let spinnerElement = document.getElementById(`${dependency.name}-spinner`)
    let textElement = document.getElementById(`${dependency.name}-status`)
    if (dependency.installing) {
      // mongodb
      spinnerElement.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
      textElement.innerHTML = `Installing ${dependency.name} and it's component`
    } else if (!dependency.installing) {
      spinnerElement.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      if (dependency.componentInstallationFailed.length > 0) {
        let output = `Installation failed for component ${dependency.name}`
        spinnerElement.classList.add("fa", "fa-close")
        textElement.innerHTML = output
      } else {
        spinnerElement.classList.add("fa", "fa-check-square-o")
        textElement.innerHTML = `Installation Successful for ${dependency.name}`
      }
      // spinnerElement.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin" )
    }
  }
  // switch (dependency.name) {
  //   case 'mongodb':
  //     if(dependency.installing) {
  //       mongoSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin" )
  //       mongoStatus.innerHTML = `Installing mongo and its component...`
  //     } else if(dependency.installed) {
  //       // fa fa-solid fa-spinner fa-spin
  //       mongoSpinner.classList.remove("fa","fa-solid", "fa-spinner", "fa-spin" )
  //       mongoSpinner.classList.add("fa" ,"fa-check-square-o" )
  //     }
  // }
})
