const router = require('express').Router();
const bcrypt = require('bcrypt');
const axios = require('axios');

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
            message: "Moderator post or dismissed"
        });
    } catch (err) {
        console.log(err.message);
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
        res.status(200).json(role);
    } catch (err) {
        next(err);
    }
})

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
            url: `http://localhost:3001/${user.profile_image}`,
            method: 'GET',
            json: true
        });
        res.status(200).json({
            ...user,
            profile_image: image.data.uri !== 'None' ? 'http://localhost:3001/uploads/' + image.data.uri : null
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
                url: `${process.env.IMAGE_SERVICE}/${user.profile_image}`,
                method: 'GET',
                json: true
            });
            return {
                ...user,
                profile_image: image.data.uri !== 'None' ? `${process.env.IMAGE_SERVICE}/uploads/${image.data.uri}` : null
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
        const user = await req.con.execute("INSERT INTO accounts VALUES (null, ?, ?, ?, null, null, -1, null, 0, 3)", [email, hashedPass, userName]);
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
router.delete('/:id', async (req, res, next) => {
    const id = +req.params.id;
    if (isNaN(id) || id < 0) {
        const error = new Error('Invalid profile ID');
        error.status = 400;
        return next(error);
    }
    try {
        const dUser = await req.con.execute("DELETE FROM user WHERE id=?", [id]);
        if (dUser[0].affectedRows === 0) {
            const error = new Error('Not user with this ID');
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
router.put('/ban/:set/:id', async (req, res, next) => {
    const set = +req.params.set;
    const id = +req.params.id;
    if (isNaN(id) || id < 0 || isNaN(set)) {
        const error = new Error('Invalid params');
        error.status = 400;
        return next(error);
    }
    try {
        await req.con.execute("UPDATE user SET banned=? WHERE id=?", [set, id]);
        res.status(200).json({
            message: 'User banned or unbanned',
            id
        });
    } catch (err) {
        console.log(err);
        next(err);
    }
});

module.exports = router;