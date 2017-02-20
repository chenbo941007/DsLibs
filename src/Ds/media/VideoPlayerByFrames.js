/**
 * @class Ds.media.VideoPlayerByFrames
 * @classdesc:视频播放序列帧播放器
 * @extends
 * @example://默认初始化的时候 视频不放到可见区域
   _VideoInteractivePlayer = new VideoFramesPlayerModel({
       imagesPath: './images/video600/',//图片的文件夹地址
       imagePrefix: 'v',//图片前缀
       imgType: 'jpg',//图片类型
       // audioPath:'./media/BGM.mp3',
       duration: 6 , //总时间
       totalframes:70,//序列图片数
       width: 1152 ,//宽
       height: 552,//高
       fps: 12,//刷新率
       appendTo: '#VideoFramesContainer',//canvas添加到dom的容器
       clickPPEvent: false,//是否双击播放或者暂停，这次项目false
       bufferedime: 3,//缓冲多少秒开始播放
       autoplay: false,//是否自动播放，这次项目不播放
       repairImgQname: true,//是否需要做补全图片名称，如有时候会使用0001.jpg需要设置true,使用1.jpg开始就不设置false
       rendFrameType: true,//渲染方式默认true Frame 帧方式
       autoLoad:true,//是否自动加载
       //播放完成事件
       endedFun: function () {
           log('VideoPlayEnd');
           VideoPlayEnd();
       },
       // loop:true,//是否循环
   });
   _VideoPanel = $('#VideoFramesContainer');
   //事件
   _VideoInteractivePlayer.on('complete', function () {
       log('VideoPanel2 complete');
   });

   _VideoInteractivePlayer.on('progress', function (e) {
       var _pro = parseInt(30 * e.progress);
       log('VideoPanel2 progress:',_pro);
   });
   _Self.VideoInteractivePlayer=_VideoInteractivePlayer

   function VideoPlayEnd(){
        _MainVM.GotoPage("ferryPage");
       _VideoPanel.css("left", "2000px");
       log("结束");
   }
   //开始加载
   _VideoInteractivePlayer.InitLoad();
 * @author: maksim email:maksim.lin@foxmail.com
 * @copyright:  我发起Ds库目的，简化方便工作项目开发。里面代码大部分理念来至曾经flash 前端时代，尽力减小类之间耦合，通过webpack按需request使用。Ds库里代码很多也都来源至或参考网络开源开放代码，所以这个库也开源开放。更多希望团队成员把积累工作中常用的代码，加快自己开发效率。
 * @constructor
 **/
!(function() {
    window.Ds = window.Ds || {};
    window.Ds.media = window.Ds.media || {};
    window.Ds.media.VideoPlayerByFrames = VideoPlayerByFrames;

    function VideoPlayerByFrames(data) {
        data = data || {};
        var _self = this;

        Ds.Extend(_self, new Ds.EventDispatcher());
        var canvas, audio;
        var totalframeNum, fps = 12,
            imagesPath = '',
            audioPath = '',
            imgType = 'jpg';
        var cxt, imagesList, videoW = 480,
            videoH = 320;
        var repairImgQname = false;
        var drawNum = 0;
        var loop;
        var rendFrameType = true; //是否用帧方式 false用时间渲染
        //时间节点列表
        var _videoCuePointList = [];

        //默认每秒12帧画面
        fps = data.fps ? data.fps : fps;
        //加载图片路径
        imagesPath = data.imagesPath ? data.imagesPath : imagesPath;
        //声音路径
        audioPath = data.audioPath ? data.audioPath : audioPath;
        //是否自动加载
        autoLoad = data.autoLoad ? true : false;
        //是否自动播放
        autoplay = data.autoplay ? true : false;
        //图片总数
        totalframeNum = data.totalframes ? data.totalframes : -1;
        var endedFun = data.endedFun ? data.endedFun : null;
        loop = data.loop !== undefined ? data.loop : false;
        repairImgQname = data.repairImgQname ? data.repairImgQname : false;
        imagePrefix = data.imagePrefix ? data.imagePrefix : '';
        rendFrameType = data.rendFrameType !== undefined ? data.rendFrameType : true;
        imgType = data.imgType ? data.imgType : 'jpg';
        var duration = 0;
        duration = data.duration;


        //加载了多少帧
        var imagesLoadNum = 0;
        //帧图片列表
        imagesList = [];
        //当前帧，与总帧数
        var currentFrame = 0,
            totalframes = totalframeNum - 1;
        var currentTime = 0,
            totalTime = totalframeNum / fps;

        var videoPlayEnd = false;


        canvas = document.createElement('canvas');
        if (data.width) videoW = data.width;
        if (data.height) videoH = data.height;
        // $(canvas).attr('width',videoW);
        // $(canvas).attr('height',videoH);
        if (data.clickPPEvent) $(canvas).bind('click', _self.playOrPause);
        canvas.width = videoW;
        canvas.height = videoH;

        cxt = canvas.getContext("2d");
        _self.canvas = canvas;
        $(canvas).css({
            width: '100%'
        });
        $(canvas).css({
            height: '100%'
        });

        if (audioPath === '') {
            audio = null;
        } else {
            audio = new Audio();
        }
        if (audio) {
            audio.autoplay = data.autoplay !== undefined ? data.autoplay : true;
            audio.src = audioPath;
            audio.addEventListener('loadstart', function() {
                console.log('loadstart');
            }); //客户端开始请求数据
            audio.addEventListener('abort', function() {
                console.log('abort');
            }); //客户端开始请求数据
            audio.addEventListener('waiting', _self.audioWaiting); //等待数据，并非错误
            audio.addEventListener('ended', _self.audioEnded); //播放结束
            audio.addEventListener('loadedmetadata', _self.audioLoadedmetadata); //成功获取资源长度
            audio.addEventListener('progress', _self.audioProgressEvent); //客户端正在请求数据
            audio.addEventListener('suspend', _self.audioSuspend); //延迟下载
            audio.addEventListener('play', _self.audioPlayEvent); //play()和autoplay开始播放时触发
            audio.addEventListener('pause', _self.audioPauseEvent); //pause()触发
        }

        if (data.appendTo) {
            $(data.appendTo).append(canvas);
        }

        //是否暂停
        var pause = true;
        //音乐暂停
        var audioPause = true;
        //甚至循环执行代码时间
        var fpsTimer, fpsTime = 1000 / fps;

        //判断是否是在目前是缓冲状态
        var isBufferPlay = true;
        //缓冲多少秒才开始播放
        var bufferedSpeedTime = data.bufferedime ? data.bufferedime : 2;
        //缓冲完成
        var bufferedEndToPlay = false;

        //没有声音使用自己计算的时间更新
        var noAudioupDateTime;
        var playTime;
        var pauseTime;

        function init() {
            this.canvas = canvas;
            this.audio = audio;
            this.pause = pause;

            var sequenceLength = ('' + totalframeNum).length;

            function rename(value) {
                var _src = '';
                if (!repairImgQname) {
                    _src = imagesPath + imagePrefix + value + '.' + imgType;
                } else {
                    var _srcNum = i + '';
                    var bu = sequenceLength - _srcNum.length;
                    if (bu == 4) _srcNum = '0000' + _srcNum;
                    if (bu == 3) _srcNum = '000' + _srcNum;
                    if (bu == 2) _srcNum = '00' + _srcNum;
                    if (bu == 1) _srcNum = '0' + _srcNum;
                    _src = imagesPath + imagePrefix + _srcNum + '.' + imgType;
                }
                return _src;
            }
            var img;
            //创建img序列
            for (var i = 0; i < totalframeNum; i++) {
                img = new Image();
                img.url = rename(i);
                imagesList.push(img);
            }
            // log(imagesList)

            //默认加载一张第一帧进来
            img = new Image();
            img.src = imagesList[0].url;
            img.loaded = false;
            img.onload = function() {
                cxt.drawImage(img, 0, 0, videoW, videoH);
            };

            bufferAllTime = totalframeNum / fps;
            imagesLoadNum = -1;
            //_self.loadImages();

            fpsTimer = setTimeout(_self.upDate, fpsTime);

            if (autoLoad) _self.loadImages();
            //一进来就默认播放
            if (autoplay === true) _self.play();



        }
        this.audioLoadedmetadata = function(e) {

        };
        this.audioProgressEvent = function(e) {
            // log('audioProgressEvent');
        };
        this.audioWaiting = function(e) {
            // log('audioWaiting');
        };
        this.audioEnded = function(e) {
            log('audioEnded');
            audioPause = true;
            pause = true;
        };
        this.audioSuspend = function(e) {
            log('audioSuspend');
        };
        this.audioPlayEvent = function(e) {
            log('audioPlayEvent');
            audioPause = false;
            pause = false;
            _self.videoPlayEvent();
        };
        this.audioPauseEvent = function(e) {
            log('audioPauseEvent');
            audioPause = true;
            pause = true;
            _self.videoPauseEvent();
            // log(bufferTime+'/'+audio.currentTime)
        };
        //是否缓冲中         图片是否加载完成        当前缓冲到时间点   全部缓存完成总时间
        var buffered = true,
            imagesLoadEnd = false,
            bufferTime = 0,
            bufferAllTime = 0;
        this.loadImages = function() {
            imagesLoadNum += 1;
            _self.ds({
                type: 'progress',
                progress: imagesLoadNum / imagesList.length
            });
            if (imagesLoadNum >= imagesList.length) {
                imagesLoadNum = imagesList.length - 1;
                _self.ds({
                    type: 'complete'
                });
                _self.videoLoadEdnEvent();
                return;
            }
            img = imagesList[imagesLoadNum];
            img.src = img.url;
            img.errorNum = 0;
            img.onload = function() {
                _self.videoBuffereEvent();
                _self.loadImages();
                img.loaded = true;
            };
            img.onerror = function() {
                // alert('image load error');
                // img.errorNum++;
                // img.src=img.url;
                _self.videoBuffereEvent();
                _self.loadImages();
            };
        };
        this.InitLoad = this.loadImages;
        //计算缓冲了多少秒了
        this.videoBuffereEvent = function() {
            bufferTime = (imagesLoadNum) / fps;
            imagesLoadEnd = false;

        };
        this.videoLoadEdnEvent = function() {
            log('videoLoadEdnEvent');
            bufferTime = bufferAllTime;
            imagesLoadEnd = true;
            if (data.loadEndFunc) {
                data.loadEndFunc();
            }
        };
        //缓冲完成,可以开始播放
        this.videoBuffereOutEvent = function() {
            // log('videoBuffereOutEvent')
            isBufferPlay = false;
            if (bufferedEndToPlay) {
                bufferedEndToPlay = false;
                pause = false;
                if (audio && audio.paused) audio.play();
                playTime = new Date().getTime();
            }
        };
        //需要进行缓冲
        this.videoBuffereInEvent = function() {
            pauseTime = new Date().getTime();
            pause = true;
            isBufferPlay = true;
        };

        this.videoPauseEvent = function() {

        };
        this.videoPlayEvent = function() {

        };

        /**
         * 播放或者暂定
         * @return {[type]} [description]
         */
        this.playOrPause = function() {
            if (pause) _self.play();
            else _self.pause();
        };

        /**
         * 播放
         * @return {[type]} [description]
         */
        this.play = function() {
            //设置当前是播放状态
            pause = false;
            //退出缓冲判断-
            bufferedEndToPlay = false;
            _self.videoBuffereOutEvent();
            // log('audio:',audio,audio.paused)
            if (audio && audio.paused) {
                audio.play();
            }
            playTime = new Date().getTime();
        };
        /**
         * 暂停
         * @return {[type]} [description]
         */
        this.pause = function() {
            pause = true;
            //退出缓冲判断
            bufferedEndToPlay = false;
            _self.videoBuffereOutEvent();
            if (audio) audio.pause();
            pauseTime = new Date().getTime();
        };
        /**
         * 获取播放器当前是否播放状态
         * @return {[type]} [description]
         */
        this.getPause = function() {
            return pause;
        };
        /**
         * 设置播放时间点
         * @param {[type]} value  [时间]
         * @param {[type]} _play [设置是否播放true播放  false暂停  不设置按当前状态]
         */
        this.setCurrentTime = function(value, _play) {
            log(" setCurrentTime", value, _play);

            if (_play !== undefined) {
                //log(" setCurrentTime", _play)
                if (_play) {
                    _self.play();
                } else {
                    _self.pause();
                }
            }
            //处理时间节点
            for (var i = 0; i < _videoCuePointList.length; i++) {
                var _pointData = _videoCuePointList[i];
                if (_pointData.time && _pointData.time >= value) _pointData.bool = false;
            }
            if (value >= totalTime) {
                value = totalTime;
            } else {
                videoPlayEnd = false;
                //log(" videoPlayEnd = false;")
            }
            currentTime = value;
            if (audio) audio.currentTime = value;
            if (rendFrameType) {
                drawNum = ((currentTime * fps) >> 0) - 1;
                // log(currentTime,drawNum);
                if (drawNum >= totalframes) drawNum = totalframes;
                if (drawNum < -1) drawNum = -1;
            }
            // log(" setCurrentTime2", pause,rendFrameType, currentTime+'>>'+drawNum);
            _self.upDate();
        };


        /**
         * 时间事件点
         * @param {[type]} pointData [description]
         */
        this.addCuePoint = function(pointData) {
            if (!pointData.time) {
                return;
            }
            if (!pointData.name) pointData.name = 'time_' + pointData.time;
            pointData.runNum = 0;
            pointData.bool = false;
            _videoCuePointList.push(pointData);
        };
        /**
         * 所有的时间点触发重置
         * @return {[type]} [description]
         */
        this.resetCuePointListData = function() {
            for (var i = 0; i < _videoCuePointList.length; i++) {
                var _pointData = _videoCuePointList[i];
                _pointData.runNum = 0;
                _pointData.bool = false;
            }
        };
        /**
         * 重置制定名称的时间触发
         * @param  {[type]} name [description]
         * @return {[type]}      [description]
         */
        this.resetCuePointByName = function(name) {
            for (var i = 0; i < _videoCuePointList.length; i++) {
                var _pointData = _videoCuePointList[i];
                if (_pointData.name == name) {
                    _pointData.bool = false;
                    _pointData.runNum = 0;
                }
            }
        };
        this.clearCuePointList = function() {
            _videoCuePointList = [];
        };
        /*使用Video标签的TimeUpDate*/
        function videoDomTimeUpDate(e) {

            _nowTime = _self.currentTime;
            // log(_nowTime)
            for (var i = 0; i < _videoCuePointList.length; i++) {
                var _pointData = _videoCuePointList[i];
                if (_pointData.time && _nowTime >= _pointData.time && !_pointData.bool) {
                    _pointData.bool = true;
                    _pointData.runNum += 1;
                    _self.ds({
                        type: 'cuePoint',
                        data: _pointData,
                        time: _nowTime
                    });
                }
            }
        }
        /**
         * 渲染更新
         * @return {[type]} [description]
         */
        this.upDate = function() {
            clearTimeout(fpsTimer);
            if (audio) {
                //缓冲状态
                if (isBufferPlay) {
                    //0
                    if (audio.currentTime < bufferTime - bufferedSpeedTime) {
                        //缓冲时间已经有余退出缓冲
                        _self.videoBuffereOutEvent();
                    }
                    // else if (bufferTime >= audio.duration || bufferTime >= bufferAllTime) {
                    else if (bufferTime >= duration || bufferTime >= bufferAllTime) {
                        _self.videoBuffereOutEvent();
                    }
                }
                if (!isBufferPlay) {
                    //非缓存状态下 播放视频的帧不足，需要进入到缓冲部分
                    if (bufferTime >= bufferAllTime) {

                    } else if (audio.currentTime >= bufferTime) {
                        _self.videoBuffereInEvent();
                        //缓冲时候声音暂停，
                        audio.pause();
                        //同时视频也要暂停
                        pause = true;
                        bufferedEndToPlay = true;
                    }
                }
                drawNum = audio.currentTime * fps >> 0;
                if (audio.currentTime >= bufferTime) drawNum = totalframes;
                currentTime = audio.currentTime;
            } else {

                if (!pause) {
                    //使用帧渲染
                    if (rendFrameType) {
                        drawNum += 1;
                        currentTime = drawNum / fps;
                        if (drawNum >= totalframes) drawNum = totalframes;
                        if (currentTime >= totalTime) currentTime = totalTime;
                    } else {
                        //使用时间进行渲染
                        var _time = (new Date().getTime() - playTime) / 1000;
                        currentTime = currentTime + _time;
                        if (currentTime >= totalTime) {
                            currentTime = totalTime;
                            drawNum = totalframes;
                        } else {
                            drawNum = currentTime * fps >> 0;
                        }
                    }


                }

                //缓冲状态
                if (isBufferPlay) {
                    //0
                    if (currentTime < bufferTime - bufferedSpeedTime) {
                        //缓冲时间已经有余退出缓冲
                        _self.videoBuffereOutEvent();
                    } else if (bufferTime >= bufferAllTime) {
                        _self.videoBuffereOutEvent();
                    }
                }
                if (!isBufferPlay) {
                    //非缓存状态下 播放视频的帧不足，需要进入到缓冲部分
                    if (bufferTime >= bufferAllTime) {

                    } else if (currentTime >= bufferTime) {
                        _self.videoBuffereInEvent();
                        //同时视频也要暂停
                        pause = true;
                        bufferedEndToPlay = true;
                    }
                }


            }


            if (!pause) {
                if (drawNum >= imagesList.length) {
                    drawNum = imagesList.length - 1;
                    _self.pause();
                }
                img = imagesList[drawNum];
                if (img.loaded) {
                    cxt.drawImage(img, 0, 0, videoW, videoH);
                }

                if (drawNum == imagesList.length - 1) {
                    // log('videoPlayEnd :', videoPlayEnd, loop)
                    if (videoPlayEnd) {
                        return;
                    }
                    videoPlayEnd = true;
                    if (endedFun) {
                        endedFun();
                    }
                    if (loop) {
                        _self.setCurrentTime(0, true);
                    }
                }
            }
            _self.currentTime = currentTime;

            // $('#soundDebug').html(currentTime+'/'+totalTime+'<br>'+drawNum+'/'+totalframes
            //     +'<br>'+currentTime+'/'+bufferTime
            //     +'<br>imageload:'+imagesLoadNum
            //     +'<br>pause:'+pause
            //     )
            videoDomTimeUpDate();
            fpsTimer = setTimeout(_self.upDate, fpsTime);
        };
        init();
    }
})();
