const bcrypt = require('bcrypt');
const { promisify } = require('util');
const request = promisify(require('request'));


exports.getProfileById = async (req, res, next) => {
    const id = +req.params.id;
    if (isNaN(id) || id < 0) {
        const error = new Error('Invalid profile ID');
        error.status = 400;
        return next(error);
    }
    try {
        const user = (await req.con.execute("SELECT * FROM user WHERE id=?", [id]))[0][0];
        const image = await request({
            uri: `http://localhost:3001/${user.profile_image}`,
            method: 'GET'
        });
        res.status(200).json({
            ...user,
            profile_image: `http://localhost:3001/uploads/${JSON.parse(image.body).uri}`
        });
    } catch (err) {
        console.log(err);
        next(new Error('Failed to view user'));
    }
};

exports.getAllProfiles = async (req, res, next) => {
    try {
        const quantity = +req.params.quantity;
        const page = +req.params.page;
        if (!quantity || !page || page < 1 || quantity < 1) {
            const error = new Error('Invalid quantity or page');
            error.status = 400;
            return next(error);
        }
        const users = (await req.con.execute("SELECT * FROM user ORDER BY user_name ASC LIMIT ?, ?",
            [
                quantity * (page - 1),
                quantity
            ]))[0];

        const usersImages = await Promise.all(users.map(async user => {
            const image = await request({
                uri: `http://localhost:3001/${user.profile_image}`,
                method: 'GET'
            });
            return {
                ...user,
                profile_image: (image.statusCode === 200 ? ('http://localhost:3001/uploads/' + JSON.parse(image.body).uri) : null)
            }
        }));
        const quantityUsers = await req.con.execute("SELECT COUNT(1) FROM user");
        res.status(200).json({
            count: quantityUsers[0][0]['COUNT(1)'],
            users: { ...usersImages }
        });
    } catch (err) {
        console.log(err);
        next(new Error('Failed to view profiles'));
    }
};

exports.registerUser = async (req, res, next) => {
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
};

exports.editProfile = async (req, res, next) => {
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
    if (!email || !password || !userName || !firstName || !lastName || !profileImage || !signature) {
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
};

exports.deleteUser = async (req, res, next) => {
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
        next(new Error('Failed to delete user'))
    }
};

exports.banUser = async (req, res, next) => {
    const set = +req.params.set;
    const id = +req.params.id;
    if(isNaN(id) || id < 0 || isNaN(set)) {
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
    } catch(err) {
        console.log(err);
        next(new Error('Failed to ban user'));
    }
};