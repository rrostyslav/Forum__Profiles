const router = require('express').Router();
const ProfileController = require('../controllers/profile');

router.get('/:username', ProfileController.getProfileByUserName);

router.get('/:quantity/:page', ProfileController.getAllProfiles);

// REGISTER!!!
router.post('/', ProfileController.registerUser);

router.put('/:id', ProfileController.editProfile);

router.delete('/:id', ProfileController.deleteUser);

router.put('/ban/:set/:id', ProfileController.banUser);

module.exports = router;