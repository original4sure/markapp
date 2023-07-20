const URLS = {
  MANIFEST_JSON: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/manifest.json",
  CONFIG_JSON: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/config.json",
  REGISTER_SERVICE: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/register-service.ps1",
  NSSM_SERVICE: "https://mark-assets.s3.ap-south-1.amazonaws.com/nssm.exe",
  MARK_APP_START_TASK_XML: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/installer/markAppStartTask.xml",
  MARK_APP_START_FINALIZATION_SCRIPT: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/scripts/markAppSetupFinalization.ps1"
}

const DEPENDENCY_TYPES = {
  NSSM_SERVICE: "nssm",
  MSI_INSTALLER: "msi",
  EXECUTABLE: "process",
  ARCHIVE: "archive",
  APP_ARCHIVE: "appArchive",
  PS_SCRIPT: "psScript",
  FILE: "file"
}

const DIRECTORIES = {
  APP: "C:\\ProgramData\\O4S",
  UPDATE: "C:\\ProgramData\\O4S\\updates",
  MSI_EXECUTOR: "C:\\Windows\\System32\\msiexec.exe",
  SYSTEM: "C:\\Windows\\System32"
}

const UI_ALERT_KEYS = {
  INSTALLATION: "installation:status",
  DEPENDENCY_RUNNING: "dependency-running:status",
  UPDATE: "update:status",
  SERVICE: "service:status"
}

module.exports = {
  URLS,
  DEPENDENCY_TYPES,
  DIRECTORIES,
  UI_ALERT_KEYS
}