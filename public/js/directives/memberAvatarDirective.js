// A member's round profile photo: the small server-made thumbnail
// (app/profileThumbnails.js), over their initials so a member with no photo
// still shows something.
//
//   <member-avatar member="m" size="40"></member-avatar>
//
// `member` needs _id, firstname and lastname. The photo comes from the
// member's own profileThumbUrl when the list it came from embedded one, else
// from MemberThumbsService's one cached map of every member's thumbnail, so a
// page full of avatars costs no request per photo.
angular.module('mcrrcApp').directive('memberAvatar', ['MemberThumbsService', function (MemberThumbsService) {
    return {
        restrict: 'E',
        scope: {
            member: '<',
            size: '@'
        },
        template:
            '<span class="member-avatar" ng-style="box">' +
            '<span class="member-avatar-initials">{{initials}}</span>' +
            '<img ng-if="src" ng-src="{{src}}" alt="" onerror="this.style.display=\'none\'">' +
            '</span>',
        link: function (scope) {
            scope.$watchGroup(['member._id', 'member.profileThumbUrl', 'size'], function () {
                var m = scope.member || {};
                var size = parseInt(scope.size, 10) || 40;
                scope.box = {
                    width: size + 'px',
                    height: size + 'px',
                    fontSize: Math.round(size * 0.36) + 'px'
                };
                scope.initials = ((m.firstname || '').charAt(0) + (m.lastname || '').charAt(0)).toUpperCase();
                scope.src = m.profileThumbUrl || MemberThumbsService.peek(m._id);
                if (!scope.src && m._id) {
                    var id = m._id;
                    MemberThumbsService.get(id).then(function (uri) {
                        if (scope.member && scope.member._id === id) scope.src = uri;
                    });
                }
            });
        }
    };
}]);
