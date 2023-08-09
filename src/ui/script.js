const fileInput = document.querySelector("input"),
  uidManagerStatus = document.getElementById("uidManager-status")
uidManagerDownloader = document.getElementById("uidManager-spinner")
mongoStatus = document.getElementById("mongodb-status")
mongoSpinner = document.getElementById("mongodb-spinner")
serializerSpinner = document.getElementById("serializer-spinner")
serializerStatus = document.getElementById("serializer-status")
labelPrinterSpinner = document.getElementById("labelPrinter-spinner")
labelPrinterStatus = document.getElementById("labelPrinter-status")
versionElement = document.getElementById("version")
let environmentStatus = document.getElementById("env-var-status")
let environmentSpinner = document.getElementById("env-var-spinner")
let updateStatus = document.getElementById("update-status")

let serviceStatuses = []


ipcRenderer.on('app-version', (version) => {
  console.log("app version")
  console.log(version)
  versionElement.innerHTML = version
});

ipcRenderer.on('update:status', (status) => {
  console.log(JSON.stringify(status))

  if (Object.keys(status).includes(`updating`)) {
    if (status.updating) {
      updateStatus.innerHTML = 'Updating Mark Services'
    } else {
      let isUpdatedSuccesfully = status['updated-successfully']
      if (isUpdatedSuccesfully) {
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
})


ipcRenderer.on('service:status', (status) => {
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
    let style 
    if (serviceNotRunning.length > 1) {
      message = `Services ${serviceNotRunning.map(service => service.name).join(", ")} are not running`
      style = `color: #f54040;font-size:28px;`
      // serviceSpinner.classList.add("fa", "fa-close")
    } else if (serviceNotRunning.length === 1) {
      style = `color: #f54040;font-size:28px;`
      message = `Service ${serviceNotRunning[0].name} is not running`
      // serviceSpinner.classList.add("fa", "fa-close")
    } else {
      // serviceSpinner.classList.add("fa", "fa-check-square-o")
      style = `color: #48bf51;font-size:28px;`
      message = `Mark is up and running`
    }
    serviceStatus.innerHTML = message
    serviceStatus.style = style
  }
});

ipcRenderer.on('installation:status', (installationStatus) => {
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
      serviceStatus.innerHTML = `Starting up the services`
    }
    else if (installationStatus.servicesNotRunning.length > 0) {
      let serviceSpinner = document.getElementById("service-already-installed-spinner")
      serviceSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
      serviceSpinner.classList.add("fa", "fa-close")
      let serviceStatus = document.getElementById("service-already-installed-status")
      serviceStatus.innerHTML = `Service ${installationStatus.servicesNotRunning.join(", ")} not running!!`
    }
  }
})
ipcRenderer.on('dependency-running:status', (dependencyStatuses) => {
  for (let dependency of dependencyStatuses) {

    let spinnerElement = document.getElementById(`${dependency.name}-spinner`)
    let textElement = document.getElementById(`${dependency.name}-status`)
    if (dependency.installing) {
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
    }
  }

})

ipcRenderer.on('environment:status', (environmentSetupStatus) => {
  if(environmentSetupStatus.configuring) {
    environmentSpinner.classList.add("fa", "fa-solid", "fa-spinner", "fa-spin")
    environmentStatus.innerHTML = `Setting up environment variables`
  } else {
    environmentSpinner.classList.remove("fa", "fa-solid", "fa-spinner", "fa-spin")
    if(environmentSetupStatus.configuredSuccessfully) {
      environmentSpinner.classList.add("fa", "fa-check-square-o")
      environmentStatus.innerHTML = `Environment variables setup successfully`
    } else {
      environmentSpinner.classList.add("fa", "fa-close")
      environmentStatus.innerHTML = `Environment variables setup failed`
    }
  }
})
