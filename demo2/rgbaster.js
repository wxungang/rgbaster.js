;(function (window, undefined) {

    "use strict";

    // Helper functions.
    var getContext = function (width, height) {
        var canvas = document.createElement("canvas");
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        return canvas.getContext('2d');
    };

    var getImageData = function (img, loaded) {

        var imgObj = new Image();
        var imgSrc = img.src || img;

        // Can't set cross origin to be anonymous for data url's
        // https://github.com/mrdoob/three.js/issues/1305
        if (imgSrc.substring(0, 5) !== 'data:')
            imgObj.crossOrigin = "Anonymous";

        imgObj.onload = function () {
            //图片尺寸数据 保存
            RGBaster.image = RGBaster.image || {};
            RGBaster.image.width = imgObj.width;
            RGBaster.image.height = imgObj.height;

            var context = getContext(imgObj.width, imgObj.height);
            context.drawImage(imgObj, 0, 0);

            var imageData = context.getImageData(0, 0, imgObj.width, imgObj.height);
            loaded && loaded(imageData.data);
        };

        imgObj.src = imgSrc;

    };

    var makeRGB = function (name) {
        return ['rgb(', name, ')'].join('');
    };

    var mapPalette = function (palette) {
        var arr = [];
        for (var prop in palette) {
            arr.push(frmtPobj(prop, palette[prop]))
        }
        ;
        arr.sort(function (a, b) {
            return (b.count - a.count)
        });
        return arr;
    };

    var fitPalette = function (arr, fitSize) {
        if (arr.length > fitSize) {
            return arr.slice(0, fitSize);
        } else {
            for (var i = arr.length - 1; i < fitSize - 1; i++) {
                arr.push(frmtPobj('0,0,0', 0))
            }
            ;
            return arr;
        }
        ;
    };

    var frmtPobj = function (a, b) {
        return {name: a, count: b};
    };

    /**
     * 格式化 像素点 为 二维数组 de 数据
     * @param imgData 原始 数据 rgb格式
     * @returns {Array} =[width][height]
     */
    var fmtImgData = function (imgData) {
        var _fmtImgData = [];
        var _rgbString = [];
        var i = 0;
        for (; i < imgData.length; i += 4) {

            _rgbString[0] = imgData[i];
            _rgbString[1] = imgData[i + 1];
            _rgbString[2] = imgData[i + 2];
            _rgbString[3] = imgData[i + 3]; //计数排序中 是否 考虑透明度的情况

            //拼接_rgbString 转化 为 二位数组
            var _y = parseInt(i / (4 * RGBaster.image.width));
            var _x = (i / 4) % RGBaster.image.width;
            _fmtImgData[_y] = _fmtImgData[_y] || [];
            _fmtImgData[_y][_x] = _rgbString.join(",");

        }
        //console.log(_fmtImgData);
        return _fmtImgData;
    }

    // @param fmtImgData 格式化之后的数据

    var backColorRange = function (fmtImgData, ratio = RGBaster.backColorRange.ratio) {
        let _colorCounts = {};
        let _y = RGBaster.image.height;
        let _x = RGBaster.image.width;
        for (let y = 0; y < fmtImgData.length; y++) {
            for (let x = 0; x < fmtImgData[y].length; x++) {
                if (!(x > ratio * _x && x < _x - ratio * _x && y > ratio * _y && y < _y - ratio * _y)) {
                    let _rgbString = fmtImgData[y][x];//可以定义到外层。避免重定义。内部个人认为可读性比较好！
                    //边缘颜色 计数
                    if (_rgbString in _colorCounts) {
                        _colorCounts[_rgbString] = _colorCounts[_rgbString] + 1;
                    }
                    else {
                        _colorCounts[_rgbString] = 1;
                    }
                }
            }
        }


        console.log(mapPalette(_colorCounts)[0]);
        RGBaster.backColorRange.color = mapPalette(_colorCounts)[0];
        return RGBaster.backColorRange.color;
    }


    // RGBaster Object
    // ---------------
    //


    var RGBaster = {
        PALETTESIZE: 10,
        backColorRange: {
            ratio: 0.1,
            bias: 15,
            color: ''
        },
        image: {
            width: 0,
            height: 0
        }


    };

    RGBaster.colors = function (img, opts) {

        opts = opts || {};
        var exclude = opts.exclude || []; // for example, to exclude white and black:  [ '0,0,0', '255,255,255' ]
        let paletteSize = opts.paletteSize || RGBaster.PALETTESIZE;

        getImageData(img, function (data) {

            var colorCounts = {},
                rgbString = '',
                rgb = [],
                colors = {
                    dominant: {name: '', count: 0},
                    palette: []
                };
            let _backColorRangeArr = backColorRange(fmtImgData(data)).name.split(',');
            let _bias = RGBaster.backColorRange.bias;
            var i = 0;
            for (; i < data.length; i += 4) {
                rgb[0] = data[i];
                rgb[1] = data[i + 1];
                rgb[2] = data[i + 2];
                // rgb[3] = data[i + 3]; //计数排序中不考虑透明度的情况
                rgbString = rgb.join(",");

                // skip undefined data and transparent pixels
                if (rgb.indexOf(undefined) !== -1 || data[i + 3] === 0) {
                    continue;
                }

                //skip background color range
                if ((Math.abs(_backColorRangeArr[0] - data[i]) < _bias && Math.abs(_backColorRangeArr[1] - data[i + 1]) < _bias && Math.abs(_backColorRangeArr[2] - data[i + 2]) < _bias)) {
                    // console.log(rgbString)
                   continue;
                }
                // Ignore those colors in the exclude list.
                if (exclude.indexOf(makeRGB(rgbString)) === -1) {
                    //计数
                    if (rgbString in colorCounts) {
                        colorCounts[rgbString] = colorCounts[rgbString] + 1;
                    }
                    else {
                        colorCounts[rgbString] = 1;
                    }
                }

            }

            if (opts.success) {
                var palette = fitPalette(mapPalette(colorCounts), paletteSize + 1);
                opts.success({
                    dominant: palette[0].name,
                    secondary: palette[1].name,
                    palette: palette.map(function (c) {
                        return c.name;
                    }).slice(0)
                });
            }
        });
    };

    window.RGBaster = window.RGBaster || RGBaster;

})(window);
