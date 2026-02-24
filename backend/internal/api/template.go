package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/surls/backend/internal/response"
	"github.com/surls/backend/internal/service"
)

// TemplateHandler 跳转模板处理器
type TemplateHandler struct {
	templateService *service.TemplateService
}

// NewTemplateHandler 创建模板处理器
func NewTemplateHandler(templateService *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{
		templateService: templateService,
	}
}

// CreateTemplate 创建跳转模板
// @Summary 创建跳转模板
// @Tags templates
// @Accept json
// @Produce json
// @Param request body service.CreateTemplateRequest true "创建请求"
// @Success 200 {object} response.Response{data=models.RedirectTemplate}
// @Router /api/admin/templates [post]
func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	var req service.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	template, err := h.templateService.Create(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, template)
}

// UpdateTemplate 更新跳转模板
// @Summary 更新跳转模板
// @Tags templates
// @Accept json
// @Produce json
// @Param id path int true "模板ID"
// @Param request body service.UpdateTemplateRequest true "更新请求"
// @Success 200 {object} response.Response{data=models.RedirectTemplate}
// @Router /api/admin/templates/{id} [put]
func (h *TemplateHandler) UpdateTemplate(c *gin.Context) {
	id, err := getParamID(c)
	if err != nil {
		response.BadRequest(c, "invalid template id")
		return
	}

	var req service.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	template, err := h.templateService.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, template)
}

// DeleteTemplate 删除跳转模板
// @Summary 删除跳转模板
// @Tags templates
// @Produce json
// @Param id path int true "模板ID"
// @Success 200 {object} response.Response
// @Router /api/admin/templates/{id} [delete]
func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	id, err := getParamID(c)
	if err != nil {
		response.BadRequest(c, "invalid template id")
		return
	}

	if err := h.templateService.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "template deleted successfully"})
}

// GetTemplate 获取模板详情
// @Summary 获取模板详情
// @Tags templates
// @Produce json
// @Param id path int true "模板ID"
// @Success 200 {object} response.Response{data=models.RedirectTemplate}
// @Router /api/admin/templates/{id} [get]
func (h *TemplateHandler) GetTemplate(c *gin.Context) {
	id, err := getParamID(c)
	if err != nil {
		response.BadRequest(c, "invalid template id")
		return
	}

	template, err := h.templateService.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, http.StatusNotFound, err.Error())
		return
	}

	response.Success(c, template)
}

// ListTemplates 列出所有模板
// @Summary 列出所有模板
// @Tags templates
// @Produce json
// @Success 200 {object} response.Response{data=[]models.RedirectTemplate}
// @Router /api/admin/templates [get]
func (h *TemplateHandler) ListTemplates(c *gin.Context) {
	templates, err := h.templateService.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, templates)
}

// SetDefaultTemplate 设置默认模板
// @Summary 设置默认模板
// @Tags templates
// @Produce json
// @Param id path int true "模板ID"
// @Success 200 {object} response.Response
// @Router /api/admin/templates/{id}/default [post]
func (h *TemplateHandler) SetDefaultTemplate(c *gin.Context) {
	id, err := getParamID(c)
	if err != nil {
		response.BadRequest(c, "invalid template id")
		return
	}

	if err := h.templateService.SetDefault(c.Request.Context(), id); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "default template set successfully"})
}

// getParamID 从路径参数获取ID
func getParamID(c *gin.Context) (uint, error) {
	var id struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&id); err != nil {
		return 0, err
	}
	return id.ID, nil
}
