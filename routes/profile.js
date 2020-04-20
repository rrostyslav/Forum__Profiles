const router = require('express').Router();
const bcrypt = require('bcrypt');

router.get('/:id', async (req, res, next) => {
    const id = +req.params.id;
    if (isNaN(id) || id < 0) {
        const error = new Error('Invalid profile ID');
        error.status = 400;
        return next(error);
    }
    try {
        const user = (await req.con.execute("SELECT id, email, user_name, first_name, last_name, profile_image, signature, banned FROM user WHERE id=?", [id]))[0][0];
        res.status(200).json({
            ...user,
            profile_image: 234 // get from image service
        });
    } catch (err) {
        console.log(err);
        next(new Error('Failed to view user'));
    }
});

router.get('/', async (req, res, next) => {
    try {
        const users = (await req.con.execute("SELECT id, email, user_name, first_name, last_name, profile_image, signature, banned FROM user"))[0];
        const usersImages = users.map(user => {
            return {
                ...user,
                profile_image: 5 // get from image service
            }
        })
        res.status(200).json({
            ...usersImages
        });
    } catch (err) {
        console.log(err);
        next(new Error('Failed to view profiles'));
    }
});

// REGISTER!!!
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
        const user = await req.con.execute("INSERT INTO user VALUES (null, ?, ?, ?, null, null, null, null, 0);", [email, hashedPass, userName]);
        res.status(200).json({
            userId: user[0].insertId,
            message: 'User created'
        });
    } catch (err) {
        console.log(err);
        if (err.code === 'ER_DUP_ENTRY') {
            const error = new Error('Duplicate email or username');
            error.status = 400;
            return next(error);
        }
        next(new Error('Failed to create user'))
    }
});

router.patch('/:id', async (req, res, next) => {
    const id = +req.params.id;
    const email = req.body.email;
    const password = req.body.password;
    const userName = req.body.userName;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const profileImage = req.body.profileImage;
    const signature = req.body.signature;
    if (isNaN(id) || id < 0) {
        const error = new Error('Invalid profile ID');
        error.status = 400;
        return next(error);
    }
    if(!email || !password || !userName || !firstName || !lastName || !profileImage || !signature) {
        const error = new Error('Fields not provided');
        error.status = 400;
        return next(error);
    }
    const hashedPass = await bcrypt.hash(password, 12);
    try {
        await req.con.execute("UPDATE user SET email=?, password=?, user_name=?, first_name=?, last_name=?, profile_image=?, signature=? WHERE id=?", 
        [
            email,
            hashedPass,
            userName,
            firstName,
            lastName,
            profileImage,
            signature,
            id
        ]);
        res.status(200).json({
            message: "User edited"
        });
    } catch (err) {
        console.log(err);
        next(new Error('Failed to edit user'));
    }
});

router.delete('/:id', (req, res, next) => {

});

module.exports = router;