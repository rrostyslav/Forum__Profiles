const router = require('express').Router();
const bcrypt = require('bcrypt');
const { promisify } = require('util');
const request = promisify(require('request'));

const ProfileController = require('../controllers/profile');

router.get('/:id', ProfileController.getProfileById);

router.get('/:quantity/:page', ProfileController.getAllProfiles);

// REGISTER!!!
router.post('/', ProfileController.registerUser);

router.put('/:id', ProfileController.editProfile);

router.delete('/:id', ProfileController.deleteUser);

router.put('/ban/:set/:id', ProfileController.banUser);

module.exports = router;