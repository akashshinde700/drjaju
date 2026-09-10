const express = require('express');
const labAdviceGroupsController = require('../controllers/labAdviceGroupsController');

const router = express.Router();

router.get('/', labAdviceGroupsController.list);
router.post('/', labAdviceGroupsController.create);
router.put('/:id', labAdviceGroupsController.update);
router.delete('/:id', labAdviceGroupsController.remove);

module.exports = router;

