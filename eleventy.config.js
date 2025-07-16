export default async function (eleventyConfig) {
    eleventyConfig.setInputDirectory('src');
    eleventyConfig.setOutputDirectory('dist');
    eleventyConfig.addPassthroughCopy('src/images');
    eleventyConfig.addPassthroughCopy('src/admin/config.yml');
    eleventyConfig.addPassthroughCopy({
        'node_modules/decap-cms/dist/decap-cms.js': 'js/decap-cms.js',
        'node_modules/decap-cms/dist/decap-cms.js.map': 'js/decap-cms.js.map',
    });
}
