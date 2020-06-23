'use strict';
const router = require('express').Router();
const bcrypt = require('bcrypt');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Make moderator
router.put('/makemoder/:set', async (req, res, next) => {
  const login = req.body.userName;
  const role = +req.params.set ? 2 : 3;
  if (!login) {
    const error = new Error('No username');
    error.status = 400;
    return next(error);
  }
  try {
    await req.con.execute("UPDATE accounts SET role_id=? WHERE user_name=?", [role, login]);
    res.status(200).json({
      success: true,
      message: "Moderator post or dismissed"
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// Get role by id
router.get('/role/:id', async (req, res, next) => {
  const id = +req.params.id;
  if (isNaN(id)) {
    const error = new Error('Bad id');
    error.status = 400;
    return next(error);
  }
  try {
    const response = await req.con.execute("SELECT * FROM roles WHERE id=?", [id]);
    if (response[0].length === 0) {
      const error = new Error('Role not found');
      error.status = 404;
      return next(error);
    }
    const role = response[0][0];
    res.status(200).json({
      success: true,
      role: role
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.post('/sendreset', async (req, res, next) => {
  const email = req.body.email;
  const frontURI = req.body.frontURI;
  try {
    const [result] = await req.con.execute("SELECT COUNT(1) from accounts WHERE email=?", [email]);
    if (result[0]['COUNT(1)'] !== 1) return res.sendStatus(404);
    const code = jwt.sign({ email: email }, process.env.RESET_PASS_CODE, { expiresIn: '5m' });
    axios({
      url: `${process.env.EMAIL_SERVICE}/recovery`,
      method: 'POST',
      data: {
        link: `${frontURI}/reset/${code}`,
        email: email
      }
    });
    res.status(200).json({
      success: true
    })
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
})

router.post('/reset', async (req, res, next) => {
  const newPassword = req.body.password;
  const reset_code = req.body.reset_code;
  try {
    const payload = jwt.verify(reset_code, process.env.RESET_PASS_CODE);
    const password = await bcrypt.hash(newPassword, 12);
    req.con.execute("UPDATE accounts SET password=? WHERE email=?", [password, payload.email]);
    res.status(200).json({
      success: true
    })
  } catch (err) {
    console.log(err);
    next(err);
  }
})

router.post('/verify', async (req, res, next) => {
  try {
    const code = req.body.code;
    const verified = jwt.verify(code, process.env.VERIFY_EMAIL_CODE);
    if (!verified) {
      const error = new Error();
      error.status = 400;
      return next(error);
    }
    await req.con.execute("UPDATE accounts SET verified=1 WHERE email=?", [verified.email]);
    res.status(200).json({
      success: true
    })
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.post('/sendverify', async (req, res, next) => {
  try {
    const email = req.body.email;
    const frontURI = req.body.frontURI;
    const link = `${frontURI}/verify/${jwt.sign({ email }, process.env.VERIFY_EMAIL_CODE, { expiresIn: '5m' })}`;
    axios({
      url: `${process.env.EMAIL_SERVICE}/verify`,
      method: 'POST',
      data: {
        email: email,
        link
      }
    });
    res.status(200).json({
      success: true
    })
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// Get user by username
router.get('/:username', async (req, res, next) => {
  const userName = req.params.username;
  try {
    const response = await req.con.execute("SELECT * FROM accounts WHERE user_name=?", [userName]);
    if (response[0].length === 0) {
      const error = new Error('No accounts with this name');
      error.status = 404;
      throw error;
    }
    const user = response[0][0];
    const image = await axios({
      url: `${process.env.IMAGE_SERVICE}/${user.profile_image}`,
      method: 'GET',
      json: true
    });
    const [[role]] = await req.con.execute("SELECT * FROM roles WHERE id=?", [user.role_id]);
    console.log(role);
    res.status(200).json({
      ...user,
      success: true,
      profile_image: image.data.uri !== 'None' ? `${process.env.API_GATEWAY}/uploads/${image.data.uri}` : null,
      role: role.title
    });
  }
  catch (err) {
    console.log(err);
    next(err);
  };

});

// Get user by ID
router.get('/id/:id', async (req, res, next) => {
  const id = req.params.id;
  try {
    const response = await req.con.execute("SELECT * FROM accounts WHERE id=?", [id]);
    if (response[0].length === 0) {
      const error = new Error('No accounts with this id');
      error.status = 404;
      throw error;
    }
    const [[user]] = response;
    const image = await axios({
      url: `${process.env.IMAGE_SERVICE}/${user.profile_image}`,
      method: 'GET',
      json: true
    });
    const [[role]] = await req.con.execute("SELECT * FROM roles WHERE id=?", [user.role_id]);
    console.log(role);
    res.status(200).json({
      ...user,
      profile_image: image.data.uri !== 'None' ? `${process.env.API_GATEWAY}/uploads/${image.data.uri}` : null,
      role: role.title
    });
  }
  catch (err) {
    console.log(err);
    next(err);
  };

});

// Get list of users (paged)
router.get('/:quantity/:page', async (req, res, next) => {
  try {
    const quantity = +req.params.quantity;
    const page = +req.params.page;
    if (!quantity || !page || page < 1 || quantity < 1) {
      const error = new Error('Invalid quantity or page');
      error.status = 400;
      return next(error);
    }
    const users = (await req.con.execute("SELECT * FROM accounts ORDER BY user_name ASC LIMIT ?, ?",
      [
        quantity * (page - 1),
        quantity
      ]))[0];

    const usersImages = await Promise.all(users.map(async user => {
      const image = await axios({
        url: `http://${process.env.IMAGE_SERVICE}/${user.profile_image}`,
        method: 'GET',
        json: true
      });
      return {
        ...user,
        profile_image: image.data.uri !== 'None' ? `${process.env.API_GATEWAY}/uploads/${image.data.uri}` : null
      }
    }));
    const quantityUsers = await req.con.execute("SELECT COUNT(1) FROM accounts");
    res.status(200).json({
      count: quantityUsers[0][0]['COUNT(1)'],
      users: { ...usersImages }
    });
  } catch (err) {
    console.log(err);
    next(err);
  }

});

// Add new user (register)
router.post('/', async (req, res, next) => {
  const email = req.body.email;
  const userName = req.body.userName;
  const password = req.body.password;
  if (!email || !userName || !password) {
    const error = new Error('No fields provided');
    error.status = 400;
    return next(error);
  }
  const hashedPass = await bcrypt.hash(password, 12);
  try {
    const user = await req.con.execute("INSERT INTO accounts VALUES (null, ?, ?, ?, null, null, -1, null, 0, 3, null)", [email, hashedPass, userName]);
    res.status(200).json({
      userId: user[0].insertId,
      message: 'User created'
    });
  } catch (err) {
    console.log(err);
    next(err);
  }

});

// Edit user (profile)
router.put('/', async (req, res, next) => {
  const password = req.body.password;
  const userName = req.body.userName;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const profileImage = req.body.profileImage;
  const signature = req.body.signature;
  if (!password || !userName || !firstName || !lastName || !profileImage || !signature) {
    const error = new Error('Fields not provided');
    error.status = 400;
    return next(error);
  }
  const hashedPass = await bcrypt.hash(password, 12);
  try {
    await req.con.execute("UPDATE accounts SET password=?, first_name=?, last_name=?, profile_image=?, signature=? WHERE user_name=?",
      [
        hashedPass,
        firstName,
        lastName,
        profileImage,
        signature,
        userName
      ]);
    res.status(200).json({
      message: "User edited"
    });
  } catch (err) {
    console.log(err);
    next(err);
  }

});

// Delete user
router.delete('/:username', async (req, res, next) => {
  const username = req.params.username;
  try {
    const dUser = await req.con.execute("DELETE FROM accounts WHERE user_name=?", [username]);
    if (dUser[0].affectedRows === 0) {
      const error = new Error('Not user with this username');
      error.status = 400;
      return next(error);
    }
    res.status(200).json({
      message: "User deleted!"
    });
  } catch (err) {
    console.log(err);
    next(err);
  }

});

// Ban user
router.put('/ban', async (req, res, next) => {
  const ban = +req.body.ban;
  const userName = req.body.user_name;
  if (typeof (ban) === 'undefined' || isNaN(ban) || !userName) {
    const error = new Error('Invalid params');
    error.status = 400;
    return next(error);
  }
  try {
    await req.con.execute("UPDATE accounts SET banned=? WHERE user_name=?", [ban, userName]);
    res.status(200).json({
      message: 'User banned or unbanned',
      user_name: userName
    });
  } catch (err) {
    console.log(err);
    next(err);
  }

});

module.exports = router;