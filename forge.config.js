module.exports = {
  packagerConfig: {
    win32metadata: {
      "requested-execution-level": "requireAdministrator"
    },
    "asar": true,
    "prune":true,
    
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'original4sure',
          name: 'markapp',
        },
        prerelease: false,
        draft: false,
      },
    }
  ],
  buildIdentifier: "mark-edge",
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: 'Sachin',
        description: 'Mark App Initializer'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};
