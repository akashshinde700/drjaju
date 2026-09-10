const LabAdviceGroupsService = require('../services/LabAdviceGroupsService');
const { asyncHandler } = require('../utils');

exports.list = asyncHandler(async (req, res) => {
  try {
    const doctorId = req.user?.id || null;
    const groups = await LabAdviceGroupsService.listGroups({ doctorId });
    return res.json({ success: true, groups });
  } catch (error) {
    console.error('Failed to fetch lab advice groups:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch lab advice groups' });
  }
});

exports.create = asyncHandler(async (req, res) => {
  try {
    const { group_name, tests } = req.body || {};
    if (!group_name) return res.status(400).json({ success: false, error: 'Group name required' });
    const doctorId = req.user?.id || null;
    const result = await LabAdviceGroupsService.addGroup({ group_name, tests, doctorId });
    return res.status(201).json({ success: true, id: result.id });
  } catch (error) {
    console.error('Failed to create lab advice group:', error);
    return res.status(500).json({ success: false, error: 'Failed to create lab advice group' });
  }
});

exports.update = asyncHandler(async (req, res) => {
  try {
    const { group_name, tests } = req.body || {};
    await LabAdviceGroupsService.updateGroup({ id: req.params.id, group_name, tests });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to update lab advice group:', error);
    return res.status(500).json({ success: false, error: 'Failed to update lab advice group' });
  }
});

exports.remove = asyncHandler(async (req, res) => {
  try {
    await LabAdviceGroupsService.deleteGroup({ id: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete lab advice group:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete lab advice group' });
  }
});

